const { getPersonality } = require('./personality-router');
const { summarizeTasksForAgent } = require('./task-manager');
const { maintenanceSnapshot } = require('./maintenance-reader');
const { executionSnapshot } = require('./execution-reader');
const { generatePassiveWorkerUpdates } = require('./humanized-summary-generator');
const { enforcePersonalityGuardrails } = require('./personality-guard');

function buildNaturalResponse({ agent, intent, topic, state, memory = {} }) {
  const safeState = normalizeState(state);
  const persona = getPersonality(agent);
  const tasks = summarizeTasksForAgent(agent);
  const maintenance = maintenanceSnapshot();
  const execution = executionSnapshot();
  const context = { persona, tasks, maintenance, execution, topic, intent, state: safeState, memory };
  const lines = [
    `[${persona.label}]`,
    persona.opener,
    ...agentLines(agent, context)
  ];

  return enforcePersonalityGuardrails(limitResponse(lines));
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
    `Sir, current health is ${formatHealth(state)} with momentum ${state.momentum || 'UNKNOWN'}.`,
    activeCount > 0
      ? `${activeCount} active task(s) are moving; I am keeping the risky parts behind review.`
      : 'No critical task is actively moving right now; I am keeping the system in watch mode.',
    `Direction: ${compact(next)}.`,
    ...accountability,
    intent === 'execution' ? `Safe execution: ${execution.dryRun.length} dry-run, ${execution.completed.length} completed, ${execution.blocked.length} blocked.` : null,
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
    ...buildAccountability('reviewer', { state, topic, memory, tasks, execution })
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
      ? `Still dangerous: ${compact(danger)}.`
      : 'No dangerous issue is recorded in the latest state.',
    blocked
      ? `Blocked execution: ${blocked.action}. Rollback/scope was not safe enough.`
      : 'No dangerous execution attempt is active.',
    ...buildAccountability('auditor', { state, topic, memory, execution })
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
    `Attempted: ${attempted}.`,
    `Succeeded: ${succeeded}.`,
    `Failed: ${failed}.`,
    `Blocked: ${blocked}.`,
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
  if (agent === 'cto') return 'checked momentum, active tasks, and real progress signals';
  return `checked ${compact(memory.lastActiveTask || first(state.sections.nextPriority) || 'the current work queue')}`;
}

function succeededText(state, execution = {}, maintenance = {}) {
  const completedExecution = first(execution.completed);
  if (completedExecution) return `${completedExecution.action} completed with rollback notes`;
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
  if (hasFailure) return 'medium, because validation has failures';
  if (state.healthScore != null && state.healthScore >= 80) return 'high, latest health is strong';
  if (state.healthScore != null && state.healthScore < 60) return 'low, health score is under pressure';
  return 'medium, based on latest report only';
}

function riskText(state) {
  if (findDanger(state)) return 'high, dangerous unresolved issue exists';
  if (state.validation.some((item) => String(item.status || '').toLowerCase() === 'failed')) return 'medium, validation is not clean';
  if (first(state.sections.risks)) return 'medium, risk is still recorded';
  return 'low, no critical risk recorded';
}

function realProgressSignal(state) {
  const passed = state.validation.filter((item) => String(item.status || '').toLowerCase() === 'passed').length;
  const failed = state.validation.filter((item) => String(item.status || '').toLowerCase() === 'failed').length;
  return [
    `build stability: ${failed ? `${failed} failing validation step(s)` : passed ? `${passed} passing validation step(s)` : 'not measured'}`,
    'typing latency: not measured; touch confidence: not measured',
    'crash reduction: not measured; memory reduction: not measured; APK impact: not measured',
    `unresolved blockers: ${state.sections.unresolved.length + state.sections.risks.length}`
  ];
}

function noRuntimeProgress(state) {
  const completed = state.sections.completedFixes.concat(state.changed.completed);
  if (completed.length === 0) return true;
  return completed.every(isDocumentationOnly);
}

function isDocumentationOnly(item) {
  return /doc|documentation|report|summary|readme|policy|guide|wording/i.test(String(item || ''));
}

function formatProgressItem(item) {
  const text = compact(item);
  return isDocumentationOnly(item)
    ? `${text} (documentation pass only - no runtime improvement)`
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
    .slice(0, 16)
    .join('\n');
  return cleaned.length > 900 ? `${cleaned.slice(0, 897)}...` : cleaned;
}

module.exports = {
  buildNaturalResponse,
  compact,
  normalizeState
};
