const { getPersonality } = require('./personality-router');
const { summarizeTasksForAgent } = require('./task-manager');
const { maintenanceSnapshot } = require('./maintenance-reader');
const { executionSnapshot } = require('./execution-reader');
const { generatePassiveWorkerUpdates } = require('./humanized-summary-generator');
const { enforcePersonalityGuardrails } = require('./personality-guard');
const {
  detectFakeProductivity,
  summarizeOperationalAssistance
} = require('../scripts/operational-assistance');
const { readRoadmap } = require('./roadmap-reader');
const { logAgentAction } = require('./agent-action-log');

const MOBILE_LABELS = {
  cto: '🧠 CTO',
  coder: '🛠 CODER',
  reviewer: '🛡 REVIEWER',
  auditor: '🚨 AUDITOR'
};

Object.assign(MOBILE_LABELS, {
  cto: '\uD83C\uDFAF CTO',
  coder: '\uD83D\uDD27 CODER',
  reviewer: '\u2696\uFE0F REVIEWER',
  auditor: '\uD83D\uDEA8 AUDITOR'
});

function buildNaturalResponse({ agent, intent, topic, state, memory = {}, detailMode = false, directive = null }) {
  const safeState = normalizeState(state);
  const persona = getPersonality(agent);
  const roadmap = readRoadmap();
  const tasks = summarizeTasksForAgent(agent);
  const maintenance = maintenanceSnapshot();
  const execution = executionSnapshot();
  const context = { persona, roadmap, tasks, maintenance, execution, topic, intent, state: safeState, memory, directive };
  logAgentAction({
    agentName: persona.label,
    actionTaken: `prepared WhatsApp ${intent || 'update'} response`,
    reason: roadmap.currentPhase.split(/\r?\n/)[0] || 'Follow roadmap and latest repo state.',
    riskLevel: 'LOW',
    outcome: 'RESPONSE_SENT'
  });
  if (!detailMode) {
    return enforcePersonalityGuardrails(buildMobileResponse(agent, context));
  }

  const lines = [
    MOBILE_LABELS[agent] || MOBILE_LABELS.cto,
    persona.opener,
    ...agentLines(agent, context)
  ];

  return enforcePersonalityGuardrails(limitResponse(lines));
}

function buildMobileResponse(agent, context) {
  const { state, topic, memory, tasks, execution, maintenance, intent, directive } = context;
  const social = buildSocialTeamResponse(agent, intent, state, memory);
  if (social) return social;
  const directiveResponse = buildDirectiveResponse(agent, intent, state, memory, directive);
  if (directiveResponse) return directiveResponse;
  if (intent === 'operational') return buildOperationalMobile(agent, state, execution, maintenance);
  const accountability = buildAccountability(agent, { state, topic, memory, tasks, execution, maintenance, intent });
  const label = MOBILE_LABELS[agent] || MOBILE_LABELS.cto;
  const noRuntime = noRuntimeProgress(state);
  const attempted = mobileAttempted(agent, state, accountability[0], noRuntime, topic, memory);
  const blocked = mobileBlocked(accountability[2], accountability[3]);
  const risk = mobileRisk(accountability[4], state);
  const next = accountability[5].replace(/^Next:\s*/, '');

  return [
    label,
    `Attempted: ${attempted}`,
    `Blocked: ${blocked}`,
    `Risk: ${risk}`,
    `Next: ${mobileNext(next, topic, memory)}`
  ].join('\n');
}

function buildDirectiveResponse(agent, intent, state, memory = {}, directive = null) {
  const activeDirective = directive || resolveRecentDirective(memory);
  const followUp = !directive && activeDirective && intent === 'current_work';
  const isFixFollowUp = followUp || (intent === 'current_work' && memory.lastRequestedAction === 'check_new_issues');
  if (intent !== 'directive' && !isFixFollowUp) return null;
  if (!activeDirective) return null;

  const target = (activeDirective && activeDirective.targetAgent) || 'coder';
  const topic = (activeDirective && activeDirective.topic) || memory.unresolvedReference || 'new issues';
  const topIssue = first(state.sections.risks) || first(state.sections.unresolved) || 'No active issue recorded in latest state.';
  const validation = validationSummary(state);
  const prefix = followUp || isFixFollowUp ? 'Continuing' : 'Assigned';

  return [
    '\uD83C\uDFAF CTO: ' + `${prefix} this sir. ${labelFor(target)} will check ${compact(topic, 48)}.`,
    `\uD83D\uDD27 CODER: Checking latest repo issues now. Top item: ${compact(topIssue, 72)}`,
    `\u2696\uFE0F REVIEWER: ${compact(validation, 72)}`,
    '\uD83D\uDEA8 AUDITOR: I will block anything risky before execution.'
  ].join('\n');
}

function resolveRecentDirective(memory = {}) {
  const recent = Array.isArray(memory.recentMessages)
    ? memory.recentMessages.find((item) => item && item.intent === 'directive')
    : null;
  if (!recent) return null;
  return {
    targetAgent: recent.targetAgent || recent.agent || 'coder',
    action: recent.action || 'follow_instruction',
    topic: recent.topic || memory.unresolvedReference || 'new issues'
  };
}

function labelFor(agent) {
  if (agent === 'reviewer') return 'Reviewer';
  if (agent === 'auditor') return 'Auditor';
  if (agent === 'cto') return 'CTO';
  return 'Coder';
}

function buildSocialTeamResponse(agent, intent, state, memory = {}) {
  if (shouldPushBack(memory)) return null;
  if (agent !== 'cto' && ['summary', 'status_question', 'praise', 'direction', 'recent_fix_question'].includes(intent)) {
    return null;
  }
  if (intent === 'greeting' || intent === 'check_in') {
    return [
      '\uD83C\uDFAF CTO: Yes sir, team ready da. What are we working on today?',
      '\uD83D\uDD27 CODER: Ready sir \uD83D\uDCAA',
      '\u2696\uFE0F REVIEWER: Standing by.',
      '\uD83D\uDEA8 AUDITOR: Monitoring active.'
    ].join('\n');
  }

  if (intent === 'summary' || intent === 'status_question') {
    const danger = findDanger(state);
    const coderState = first(state.sections.completedFixes) || first(state.changed.completed) || 'No fresh runtime fix recorded yet.';
    return [
      '\uD83C\uDFAF CTO: Work moving sir, but not calling everything fine yet.',
      `\uD83D\uDEA8 AUDITOR: ${compact(danger || 'No new dangerous issue recorded.', 78)}`,
      `\uD83D\uDD27 CODER: ${compact(coderState, 78)}`,
      `\u2696\uFE0F REVIEWER: ${compact(validationSummary(state), 78)}`,
      '\uD83C\uDFAF CTO: Your call on next steps Sir.'
    ].join('\n');
  }

  if (intent === 'praise') {
    return [
      '🎯 CTO: Thank you sir, team worked clean.',
      '🔧 CODER: Appreciate it sir, more to do still 💪',
      '⚖️ REVIEWER: I’ll keep the safety gate tight.',
      '🚨 AUDITOR: Good progress, but I’m still watching risk.'
    ].join('\n');
  }

  if (intent === 'direction') {
    return [
      '🎯 CTO: Next move sir:',
      `1. ${compact(first(state.sections.nextPriority) || 'Stabilize the top unresolved issue.', 72)}`,
      `2. ${compact(first(state.sections.safestOpportunity) || 'Run validation before any fix.', 72)}`,
      '3. Avoid big changes until health improves.'
    ].join('\n');
  }

  if (intent === 'recent_fix_question') {
    return [
      '🎯 CTO: Recent fix memory sir:',
      `🔧 CODER: ${compact(recentFixSummary(memory) || 'No recent fix is recorded in memory yet.', 90)}`,
      `⚖️ REVIEWER: ${compact(validationSummary(state), 78)}`
    ].join('\n');
  }

  return null;
}

function recentFixSummary(memory = {}) {
  const recent = Array.isArray(memory.recentMessages)
    ? memory.recentMessages.find((item) =>
      /fix|fixed|execution_fix/i.test(`${item.intent || ''} ${item.summary || ''}`)
    )
    : null;
  return (recent && recent.summary) || memory.latestImprovement || memory.lastActiveTask || null;
}

function validationSummary(state) {
  const failed = state.validation.filter((item) => String(item.status || '').toLowerCase() === 'failed');
  if (failed.length) return `${failed.length} validation task(s) failing. Not calling it stable yet.`;
  const passed = state.validation.filter((item) => String(item.status || '').toLowerCase() === 'passed');
  if (passed.length) return `Build checks passed in latest state.`;
  return 'Build health not fully verified yet.';
}

function buildOperationalMobile(agent, state, execution, maintenance) {
  const fakePatterns = detectFakeProductivity(state, [
    ...array(execution.recent),
    ...array(maintenance.recent)
  ]);
  const summary = summarizeOperationalAssistance(state, fakePatterns).split('\n');
  const fake = fakePatterns.find((item) => /LOW OPERATIONAL IMPACT|report|Activity without improvement/i.test(item));
  return [
    MOBILE_LABELS[agent] || MOBILE_LABELS.cto,
    `Attempted: Sir, checked product signals and founder load.`,
    `Blocked: ${compact(summary[3].replace(/^Founder load:\s*/, ''), 86)}`,
    `Risk: ${fake ? 'LOW OPERATIONAL IMPACT pattern visible.' : 'no fake-progress pattern.'}`,
    `Next: ${compact(summary[4].replace(/^Next:\s*/, ''), 82)}.`
  ].join('\n');
}

function mobileAttempted(agent, state, attemptedLine, noRuntime, topic, memory = {}) {
  const prefix = tonePrefix(memory);
  if (shouldPushBack(memory)) {
    return `${prefix}${compact(memory.operationalIntelligence.pushback.message, 72)}`;
  }
  if (isContextUncertain(memory)) {
    return `${prefix}context not fully verified yet; checking latest grounded state.`;
  }
  if (memory.resolvedReference && memory.lastRequestedAction === 'fix') {
    return `${prefix}"them" means ${compact(memory.resolvedReference, 42)}. Not claiming it fixed yet.`;
  }
  if (memory.nextContinuationAction && memory.lastRequestedAction === 'continue') {
    return `${prefix}continuing ${compact(memory.nextContinuationAction.focus || topic || 'the active issue', 48)}.`;
  }
  if (topic && /swipe|trail|gesture/i.test(topic)) {
    return `${prefix}swipe line not proven fixed yet. Checking real typing feel.`;
  }
  if (memory.lastRequestedAction === 'check_status' && (topic || memory.activeFocus)) {
    return `${prefix}${compact(topic || memory.activeFocus, 48)} still not proven fixed.`;
  }
  if (noRuntime) return `${prefix}mostly maintenance today. No major typing improvement yet.`;
  const product = productSignal(state);
  if (product.perceptible === 'no') return `${prefix}no user-visible improvement proven yet.`;
  if (agent === 'reviewer') return `${prefix}checked typing confidence risk. ${product.changedSignal}.`;
  if (agent === 'auditor') return `${prefix}checked dangerous product/runtime risk.`;
  return `${prefix}${compact(attemptedLine.replace(/^Attempted:\s*/, ''), 78)}`;
}

function mobileBlocked(failedLine, blockedLine) {
  const failed = failedLine.replace(/^Failed:\s*/, '').replace(/\.$/, '');
  const blocked = blockedLine.replace(/^Blocked:\s*/, '').replace(/\.$/, '');
  if (!/nothing new failed|nothing explicitly blocked/i.test(failed)) return compact(failed, 84);
  return compact(blocked, 84);
}

function mobileRisk(riskLine, state) {
  const risk = riskLine.replace(/^Confidence:[^.]*\.\s*Risk:\s*/, '').replace(/\.$/, '');
  if (noRuntimeProgress(state) && !findDanger(state)) return 'low operational impact.';
  return `${compact(risk, 72)}.`;
}

function isContextUncertain(memory = {}) {
  const conflicts = Array.isArray(memory.semanticConflicts)
    ? memory.semanticConflicts
    : array(memory.semanticFounderState && memory.semanticFounderState.semanticConflicts);
  const confidence = memory.contextConfidence == null
    ? memory.semanticFounderState && memory.semanticFounderState.contextConfidence
    : memory.contextConfidence;
  return conflicts.length > 0 || (confidence != null && confidence < 0.55);
}

function mobileNext(next, topic, memory = {}) {
  if (shouldPushBack(memory)) {
    return compact(memory.operationalIntelligence.pushback.saferAlternative, 82);
  }
  if (
    memory.nextContinuationAction &&
    memory.nextContinuationAction.nextAction &&
    (memory.resolvedReference || ['continue', 'fix', 'check_status'].includes(memory.lastRequestedAction))
  ) {
    return compact(memory.nextContinuationAction.nextAction, 82);
  }
  if (topic && /swipe|trail|gesture/i.test(topic)) return 'test trail continuity on real typing.';
  const pain = first(memory.repeatedPainPoints);
  if (pain === 'school mode') return 'keep replies short for school mode.';
  if (pain === 'real worker feel') return 'keep updates natural, but grounded.';
  return compact(next, 82);
}

function shouldPushBack(memory = {}) {
  return Boolean(memory.operationalIntelligence && memory.operationalIntelligence.pushback && memory.operationalIntelligence.pushback.required);
}

function tonePrefix(memory = {}) {
  if (memory.lastFounderTone === 'casual') return 'Sollunga sir. ';
  if (memory.lastFounderTone === 'low_attention') return 'Short version sir: ';
  return 'Sir, ';
}

function agentLines(agent, context) {
  if (agent === 'coder') return coderLines(context);
  if (agent === 'reviewer') return reviewerLines(context);
  if (agent === 'auditor') return auditorLines(context);
  return ctoLines(context);
}

function ctoLines({ state, topic, memory, tasks, execution, intent }) {
  const next = topic || first(state.sections.nextPriority) || memory.lastActiveTask || 'monitoring stability';
  const activeCount = tasks.totalActive || 0;
  const accountability = buildAccountability('cto', { state, topic, memory, tasks, execution, intent });
  const lines = [
    `Sir, health ${formatHealth(state)}, momentum ${state.momentum || 'UNKNOWN'}.`,
    activeCount > 0 ? `${activeCount} active task(s); review gate on.` : 'No critical task moving.',
    `Direction: ${compact(next, 90)}.`,
    ...accountability,
    intent === 'execution' ? `Safe execution: ${execution.dryRun.length} dry-run, ${execution.completed.length} completed, ${execution.blocked.length} blocked.` : null,
    'FAKE PROGRESS WATCH',
    ...fakeProgressWatch(state),
    ...realityCheck(state),
    '',
    'REAL PROGRESS SIGNAL',
    ...realProgressSignal(state)
  ];

  const passive = generatePassiveWorkerUpdates(state, { execution }).slice(0, 2);
  if (passive.length) lines.push('', ...passive);
  return lines;
}

function coderLines({ state, topic, memory, tasks, maintenance, execution, intent }) {
  const focus = topic || memory.lastActiveTask || first(state.sections.nextPriority) || 'the next safe maintenance item';
  const latestFix = memory.latestImprovement || first(state.sections.completedFixes);
  const ownedTask = first(tasks.owned);
  const dryRun = first(execution.dryRun);
  const completedExecution = first(execution.completed);
  const noRuntime = noRuntimeProgress(state);
  const lines = [
    `Sir, I am looking at ${compact(focus)}.`,
    noRuntime ? 'Sir, no major runtime improvement today. Mostly maintenance and validation work.' : null,
    latestFix
      ? `Last recorded improvement: ${formatProgressItem(latestFix)}.`
      : 'No completed coding fix is recorded in the latest state.',
    ownedTask
      ? `My assigned item is still ${compact(ownedTask.title || ownedTask.id || ownedTask)}.`
      : 'No coder-owned task is assigned right now.',
    ...buildAccountability('coder', { state, topic, memory, tasks, execution, maintenance, intent }),
    ...realityCheck(state),
  ];

  if (completedExecution) {
    lines.push(`Execution log says ${completedExecution.action} completed with rollback noted.`);
  } else if (dryRun) {
    lines.push(`I paused at dry-run on ${dryRun.action}; no risky execution done.`);
  } else if (intent === 'execution') {
    lines.push('No approved safe execution action is recorded for me right now.');
  } else if (intent === 'maintenance') {
    const maintenanceItem = first(maintenance.executed) || first(maintenance.dryRun);
    lines.push(maintenanceItem
      ? `Maintenance log shows ${maintenanceItem.action}; I am not claiming more than that.`
      : 'Maintenance is still dry-run/reporting only from my side.');
  }

  return lines;
}

function reviewerLines({ state, topic, memory, tasks, execution }) {
  const warning = memory.latestWarning || first(state.sections.risks) || first(state.sections.unresolved);
  const blocked = first(tasks.blocked) || first(execution.blocked) || first(execution.rolledBack);
  const lines = [
    topic
      ? `Sir, I checked ${compact(topic)} from a regression angle.`
      : 'Sir, I checked the latest state from a regression angle.',
    warning
      ? `Main concern: ${compact(warning)}.`
      : 'No fresh regression concern is recorded right now.',
    blocked
      ? `I am holding this until ${compact(blocked.blocked_reason || blocked.title || blocked.action || blocked)} is clear.`
      : 'Nothing is blocked by reviewer right now.',
    ...buildAccountability('reviewer', { state, topic, memory, tasks, execution }),
    ...realityCheck(state)
  ];

  const failedValidation = state.validation.find((item) => String(item.status || '').toLowerCase() === 'failed');
  if (failedValidation) lines.push(`${failedValidation.task} is still failing, so I would not call this stable yet.`);
  return lines;
}

function auditorLines({ state, topic, memory, execution }) {
  const danger = findDanger(state) || memory.latestWarning || memory.latestUnresolvedIssue;
  const blocked = first(execution.blocked) || first(execution.rolledBack);
  const lines = [
    topic
      ? `Sir, danger check on ${compact(topic)}.`
      : 'Sir, danger check only.',
    danger
      ? `Danger: ${compact(danger)}.`
      : 'No dangerous issue is recorded in the latest state.',
    blocked
      ? `Blocked execution: ${blocked.action}. Scope not safe.`
      : 'No dangerous execution attempt is active.',
    ...buildAccountability('auditor', { state, topic, memory, execution }),
    ...realityCheck(state)
  ];
  return lines;
}

function buildAccountability(agent, { state, topic, memory = {}, tasks = {}, execution = {}, maintenance = {}, intent }) {
  const attempted = attemptedText(agent, state, topic, memory, intent);
  const succeeded = succeededText(state, execution, maintenance);
  const failed = failedText(state);
  const blocked = blockedText(state, tasks, execution);
  const confidence = confidenceText(state);
  const risk = riskText(state);
  const next = topic || first(state.sections.nextPriority) || memory.lastActiveTask || 'wait for the next validation cycle';

  return [
    `Attempted: ${compact(attempted, 90)}.`,
    `Succeeded: ${compact(succeeded, 90)}.`,
    `Failed: ${compact(failed, 80)}.`,
    `Blocked: ${compact(blocked, 80)}.`,
    `Confidence: ${confidence}. Risk: ${risk}.`,
    `Next: ${compact(next)}.`
  ];
}

function attemptedText(agent, state, topic, memory, intent) {
  if (topic) return `checked ${compact(topic)} against the latest repo state`;
  if (intent === 'execution') return 'checked the safe execution log';
  if (intent === 'maintenance') return 'checked maintenance actions and dry-run results';
  if (agent === 'reviewer') return 'reviewed validation, risks, and unresolved blockers';
  if (agent === 'auditor') return 'scanned for dangerous security and stability findings';
  if (agent === 'cto') return 'checked momentum, tasks, and product signals';
  return `checked ${compact(memory.lastActiveTask || first(state.sections.nextPriority) || 'the current work queue')}`;
}

function succeededText(state, execution = {}, maintenance = {}) {
  const completedExecution = first(execution.completed);
  if (completedExecution) return `${completedExecution.action} completed with rollback noted`;
  const executedMaintenance = first(maintenance.executed);
  if (executedMaintenance) return `${executedMaintenance.action} recorded as safe maintenance`;
  const fix = first(state.sections.completedFixes) || first(state.changed.completed);
  if (fix) return formatProgressItem(fix);
  return 'no completed runtime fix recorded';
}

function failedText(state) {
  const failedValidation = state.validation.find((item) => String(item.status || '').toLowerCase() === 'failed');
  if (failedValidation) return `${failedValidation.task} is failing`;
  const repeated = first(state.sections.repeatedFailures);
  if (repeated && !/no recurring/i.test(repeated)) return compact(repeated);
  return 'nothing new failed in the latest state';
}

function blockedText(state, tasks = {}, execution = {}) {
  const blockedTask = first(tasks.blocked);
  if (blockedTask) return compact(blockedTask.title || blockedTask.blocked_reason || blockedTask.id || blockedTask);
  const blockedExecution = first(execution.blocked) || first(execution.rolledBack);
  if (blockedExecution) return compact(blockedExecution.blocked_reason || blockedExecution.action);
  const unresolved = first(state.sections.unresolved) || first(state.sections.approvals);
  if (unresolved) return compact(unresolved);
  return 'nothing explicitly blocked';
}

function confidenceText(state) {
  const hasFailure = state.validation.some((item) => String(item.status || '').toLowerCase() === 'failed');
  if (hasFailure) return 'medium; validation failing';
  if (state.healthScore != null && state.healthScore >= 80) return 'high; health strong';
  if (state.healthScore != null && state.healthScore < 60) return 'low; health under pressure';
  return 'medium; report-grounded';
}

function riskText(state) {
  if (findDanger(state)) return 'high; dangerous unresolved issue';
  if (state.validation.some((item) => String(item.status || '').toLowerCase() === 'failed')) return 'medium; validation not clean';
  if (first(state.sections.risks)) return 'medium; risk recorded';
  return 'low; no critical risk';
}

function realProgressSignal(state) {
  const passed = state.validation.filter((item) => String(item.status || '').toLowerCase() === 'passed').length;
  const failed = state.validation.filter((item) => String(item.status || '').toLowerCase() === 'failed').length;
  return [
    `build stability: ${failed ? `${failed} failing validation` : passed ? `${passed} passing validation` : 'not measured'}`,
    `unresolved blockers: ${state.sections.unresolved.length + state.sections.risks.length}`,
    'typing latency: not measured; keypress responsiveness: not measured',
    'correction rate/backspace frequency: not measured',
    'touch confidence/render cost/startup cost: not measured',
    'APK size/memory impact/hot-path allocations/crash likelihood: not measured'
  ];
}

function realityCheck(state) {
  const signal = productSignal(state);
  return [
    'REALITY CHECK',
    `actually improved for user: ${signal.userImprovement}.`,
    `measurable signal changed: ${signal.changedSignal}.`,
    `still feels weak: ${signal.weakness}.`,
    `perceptible: ${signal.perceptible}.`
  ];
}

function productSignal(state) {
  const failed = state.validation.some((item) => String(item.status || '').toLowerCase() === 'failed');
  const passed = state.validation.some((item) => String(item.status || '').toLowerCase() === 'passed');
  const runtimeFix = state.sections.completedFixes.concat(state.changed.completed).find((item) => !isLowImpact(item));
  if (runtimeFix) {
    return {
      userImprovement: compact(runtimeFix),
      changedSignal: passed ? 'build stability verified' : 'runtime signal not measured',
      weakness: 'typing feel still unmeasured',
      perceptible: 'unknown until device test'
    };
  }
  return {
    userImprovement: 'none proven',
    changedSignal: failed ? 'build stability is still failing' : passed ? 'build stability only' : 'none measured',
    weakness: 'typing feel unmeasured',
    perceptible: 'no'
  };
}

function fakeProgressWatch(state) {
  const completed = state.sections.completedFixes.concat(state.changed.completed);
  const flags = [];
  if (completed.some(isLowImpact)) flags.push('excessive reporting / cleanup-only progress risk');
  if (!completed.some((item) => !isLowImpact(item))) flags.push('no runtime impact proven');
  flags.push('agent-system bloat: watch complexity without typing gain');
  return flags.slice(0, 3);
}

function noRuntimeProgress(state) {
  const completed = state.sections.completedFixes.concat(state.changed.completed);
  if (completed.length === 0) return true;
  return completed.every(isDocumentationOnly);
}

function isDocumentationOnly(item) {
  return /doc|documentation|report|summary|readme|policy|guide|wording/i.test(String(item || ''));
}

function isLowImpact(item) {
  return /doc|documentation|report|summary|readme|policy|guide|wording|cleanup|audit|architecture|abstraction/i.test(String(item || ''));
}

function formatProgressItem(item) {
  const text = compact(item);
  if (isDocumentationOnly(item)) {
    return `${text} (documentation pass only - no runtime improvement; low operational impact)`;
  }
  return isLowImpact(item)
    ? `${text} (low operational impact)`
    : text;
}

function findDanger(state) {
  return state.sections.unresolved
    .concat(state.sections.risks)
    .find((item) => /secret|unsafe|danger|critical|security|privacy|oversized|stale/i.test(item));
}

function normalizeState(state = {}) {
  return {
    ...state,
    validation: Array.isArray(state.validation) ? state.validation : [],
    sections: {
      risks: [],
      unresolved: [],
      repeatedFailures: [],
      unstableFiles: [],
      completedFixes: [],
      approvals: [],
      nextPriority: [],
      safestOpportunity: [],
      ...(state.sections || {})
    },
    changed: {
      completed: [],
      newRisks: [],
      ...(state.changed || {})
    },
    summary: {
      nextPriority: 'No priority recorded yet.',
      topRisk: 'No top risk recorded yet.',
      ...(state.summary || {})
    }
  };
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value, max = 150) {
  const raw = String(value || '');
  const withoutSeverity = /^\[Aritenis [^\]]+\]/.test(raw) ? raw : raw.replace(/^\[[^\]]+\]\s*/, '');
  const text = withoutSeverity.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatHealth(state) {
  return state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
}

function limitResponse(lines) {
  const cleaned = lines
    .filter(Boolean)
    .map((line) => compact(line, 180))
    .slice(0, 24)
    .join('\n');
  return cleaned.length > 900 ? `${cleaned.slice(0, 897)}...` : cleaned;
}

module.exports = {
  buildNaturalResponse,
  compact,
  normalizeState
};
