const { schoolModeDigest, groupChatDailyUpdate } = require('./school-mode-policy');
const { readRoadmap } = require('./roadmap-reader');
const { logAgentAction, readActionLog } = require('./agent-action-log');
const { classifyRisk } = require('../scripts/execution-engine');
const { getDeepSeekFixLimitStatus } = require('../scripts/ai-execution-bridge');
const { readFounderMemory, formatFounderMemorySummary } = require('./founder-memory');

function linesOrFallback(items, fallback) {
  if (!items || items.length === 0) return [fallback];
  return items.slice(0, 4).map((item) => `\u2022 ${item}`);
}

function formatValidation(validation) {
  if (!validation || validation.length === 0) {
    return ['\u2022 No Android validation result is available yet.'];
  }

  return validation.map((item) => {
    const status = String(item.status || 'unknown').toUpperCase();
    const icon = status === 'PASSED' ? '\u2705' : status === 'FAILED' ? '\u274c' : '\u26a0\ufe0f';
    return `${icon} ${item.task}: ${status}`;
  });
}

function compactIssue(issue) {
  if (!issue) return 'No unresolved issue recorded yet.';
  return String(issue).replace(/^\[[^\]]+\]\s*/, '').slice(0, 180);
}

function findFocusedIssue(state, topic) {
  const needle = String(topic || '').toLowerCase();
  if (!needle) return null;
  return [...state.sections.unresolved, ...state.sections.risks].find((issue) =>
    String(issue).toLowerCase().includes(needle)
  );
}

function issueObjectFromText(text) {
  const match = String(text || '').match(/(?:^|\s)([\w./\\-]+\.\w+)(?::\d+)?/);
  return {
    type: /secret|security/i.test(text) ? 'SECURITY' : /format|spacing|whitespace/i.test(text) ? 'FORMATTING' : 'UNKNOWN',
    message: String(text || ''),
    file: match ? match[1] : ''
  };
}

function firstExecutionCandidate(state) {
  if (Array.isArray(state.unresolvedIssues) && state.unresolvedIssues.length) {
    return state.unresolvedIssues.find((issue) => issue && issue.file) || state.unresolvedIssues[0];
  }
  const issueText = (state.sections.risks[0] || state.sections.unresolved[0] || '').trim();
  return issueText ? issueObjectFromText(issueText) : null;
}

function fixOffer(state) {
  const issue = firstExecutionCandidate(state);
  if (!issue) return [];
  const risk = classifyRisk(issue);
  return [
    '',
    `Fix candidate risk: ${risk.riskLevel}`,
    `Source: ai-cto/scripts/execution-engine.js classifyRisk for ${issue.file || 'current unresolved issue'}.`,
    `Reason: ${risk.reason || 'Risk is derived from issue type, file path, and execution blast radius.'}`,
    'Calculation: deterministic risk classifier output; no model-generated score.',
    'Reply FIX to execute or SKIP to ignore'
  ];
}

function metricProvenanceLines(state, key, label) {
  const metric = state.metricProvenance && state.metricProvenance[key];
  if (!metric || !metric.value || metric.source === 'unknown') {
    return [
      `${label}: unknown`,
      'Source: unknown',
      'Reason: no verified metric source was loaded.',
      'Calculation: unknown'
    ];
  }
  return [
    `${label}: ${metric.value}`,
    `Source: ${metric.source}`,
    `Reason: ${metric.reason}`,
    `Calculation: ${metric.calculation}`
  ];
}

function formatExecutionHistory(limit = 5) {
  const actions = readActionLog().actions
    .filter((entry) => /execut|fix|commit|push|rollback|blocked|staging/i.test(`${entry.actionTaken || ''} ${entry.outcome || ''}`))
    .slice(-limit)
    .reverse();
  if (!actions.length) return ['No execution actions recorded yet.'];
  return actions.map((entry) => {
    const when = String(entry.timestamp || '').replace('T', ' ').slice(0, 16) || 'time unknown';
    const action = String(entry.actionTaken || 'action recorded').slice(0, 90);
    const outcome = String(entry.outcome || 'RECORDED').slice(0, 70);
    return `• ${when} — ${entry.agentName || 'Agent'}: ${action} (${outcome})`;
  });
}

function withStateDefaults(state) {
  const source = state && typeof state === 'object' ? state : {};
  const sections = source.sections && typeof source.sections === 'object' ? source.sections : {};
  const summary = source.summary && typeof source.summary === 'object' ? source.summary : {};
  return {
    ...source,
    sections: {
      unresolved: Array.isArray(sections.unresolved) ? sections.unresolved : [],
      risks: Array.isArray(sections.risks) ? sections.risks : [],
      repeatedFailures: Array.isArray(sections.repeatedFailures) ? sections.repeatedFailures : [],
      completedFixes: Array.isArray(sections.completedFixes) ? sections.completedFixes : [],
      nextPriority: Array.isArray(sections.nextPriority) ? sections.nextPriority : [],
      safestOpportunity: Array.isArray(sections.safestOpportunity) ? sections.safestOpportunity : [],
      approvals: Array.isArray(sections.approvals) ? sections.approvals : []
    },
    summary: {
      nextPriority: summary.nextPriority || 'No priority recorded yet.',
      topRisk: summary.topRisk || 'No active risk recorded right now.'
    },
    validation: Array.isArray(source.validation) ? source.validation : [],
    unresolvedIssues: Array.isArray(source.unresolvedIssues) ? source.unresolvedIssues : []
  };
}

function generateResponse(command, state, memory = {}, details = {}) {
  state = withStateDefaults(state);
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  const momentum = state.momentum || 'UNKNOWN';
  const generatedAt = state.generatedAt || 'not recorded yet';
  const healthIcon = state.healthScore == null ? '\u26aa' : state.healthScore >= 80 ? '\u2705' : state.healthScore >= 60 ? '\u26a0\ufe0f' : '\ud83d\udea8';
  const momentumIcon = momentum === 'STABLE' ? '\u2705' : momentum === 'STALLED' ? '\ud83d\udea8' : '\u26a0\ufe0f';
  const heartbeat = state.workflowFreshness && state.workflowFreshness.stale
    ? [`\ud83d\udea8 Heartbeat: ${state.workflowFreshness.message}`, '']
    : [];

  const roadmap = readRoadmap();
  logAgentAction({
    agentName: 'CTO',
    actionTaken: `prepared WhatsApp command response: ${command}`,
    reason: roadmap.currentPhase.split(/\r?\n/)[0] || 'Follow roadmap and latest repo state.',
    riskLevel: 'LOW',
    outcome: 'RESPONSE_SENT'
  });

  switch (command) {
    case 'status':
      return [
        'Founder, CTO status',
        ...heartbeat,
        ...metricProvenanceLines(state, 'health', `${healthIcon} Health`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        `\ud83d\udd52 Last scan: ${generatedAt}`,
        '',
        'Android validation',
        ...formatValidation(state.validation),
        '',
        `\ud83c\udfaf Next: ${state.sections.nextPriority[0] || 'No priority recorded yet.'}`
      ].join('\n');

    case 'health':
      return [
        'Founder, engineering health',
        ...metricProvenanceLines(state, 'health', `${healthIcon} Score`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        '',
        'Pressure points',
        ...linesOrFallback(state.sections.risks, 'No critical risk listed in the latest report.')
      ].join('\n');

    case 'risks':
      return [
        'Founder, latest risks',
        ...linesOrFallback(state.sections.risks, 'No new critical risk listed in the latest report.'),
        ...fixOffer(state)
      ].join('\n');

    case 'momentum':
      return [
        'Founder, momentum',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} State`),
        '',
        ...metricProvenanceLines(state, 'health', `${healthIcon} Health`),
        '',
        'Repeated failures',
        ...linesOrFallback(state.sections.repeatedFailures, 'No recurring failure pattern detected yet.')
      ].join('\n');

    case 'latest_fixes':
      return [
        'Founder, latest fixes',
        ...linesOrFallback(state.sections.completedFixes, 'No completed fix was recorded in the latest run.')
      ].join('\n');

    case 'unresolved':
    case 'pending_issues':
      return [
        'Founder, unresolved issues',
        ...linesOrFallback(state.sections.unresolved, 'No unresolved issue is recorded in the latest state.'),
        ...fixOffer(state)
      ].join('\n');

    case 'what_changed':
      return [
        'Founder, what changed',
        `\ud83d\udd52 Last trend: ${state.changed.lastTrendAt || 'not recorded yet'}`,
        `\ud83d\udccc Issues in latest trend: ${state.changed.issueCount == null ? 'unknown' : state.changed.issueCount}`,
        '',
        'Completed',
        ...linesOrFallback(state.changed.completed, 'No completed change recorded.'),
        '',
        'New risks',
        ...linesOrFallback(state.changed.newRisks, 'No new risk recorded.')
      ].join('\n');

    case 'next_priorities':
      return [
        'Founder, next priorities',
        ...linesOrFallback(state.sections.nextPriority, 'No next priority is recorded yet.'),
        '',
        'Safest safe move',
        ...linesOrFallback(state.sections.safestOpportunity, 'No safe improvement opportunity is recorded yet.')
      ].join('\n');

    case 'approvals':
      return [
        'Founder, pending approvals',
        ...linesOrFallback(state.sections.approvals, 'No approval item is pending in the latest report.')
      ].join('\n');

    case 'keyboard_health':
      return [
        'Founder, keyboard health',
        ...metricProvenanceLines(state, 'health', `${healthIcon} Repo health`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        '',
        'Keyboard risk focus',
        ...linesOrFallback(
          state.sections.unresolved.filter((item) => /keyboard|predictor|input|ime|swipe|gesture/i.test(item)),
          'No keyboard-specific issue is isolated in the latest report.'
        ),
        ...fixOffer(state)
      ].join('\n');

    case 'cto_summary':
    case 'weekly_summary':
      return [
        'Founder, CTO summary',
        ...metricProvenanceLines(state, 'health', `${healthIcon} Health`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        `\ud83e\udde0 Last focus: ${memory.lastRequestedFocusArea || 'none'}`,
        `\ud83c\udfaf Next: ${state.summary.nextPriority}`,
        '',
        'Top risk',
        `\u2022 ${state.summary.topRisk}`
      ].join('\n');

    case 'school_mode':
      return [
        'SCHOOL MODE',
        schoolModeDigest(state),
        '',
        groupChatDailyUpdate(state),
        '',
        `North star: ${roadmap.northStar.split(/\r?\n/)[0]}`
      ].join('\n');

    case 'build_now':
      return [
        'Founder, OTA build requested.',
        'GitHub Actions will validate, build, and distribute only if safety gates pass.',
        'Install path: Firebase App Distribution notification.',
        'If no notification arrives, check the Build and Distribute APK workflow.'
      ].join('\n');

    case 'fix_limit': {
      const limit = getDeepSeekFixLimitStatus();
      return [
        'Founder, DeepSeek fix limit',
        `Used today: ${limit.used}/${limit.limit}`,
        `Remaining today: ${limit.remaining}`,
        `Model: ${limit.model}`,
        `Date: ${limit.date}`
      ].join('\n');
    }

    case 'execution_status': {
      const limit = getDeepSeekFixLimitStatus();
      const commitEnabled = process.env.CTO_AI_EXECUTION_COMMIT !== 'false';
      const pushEnabled = process.env.CTO_AI_EXECUTION_PUSH !== 'false';
      const githubReady = Boolean(process.env.GITHUB_TOKEN);
      const ready = commitEnabled && pushEnabled && githubReady && limit.remaining > 0;
      return [
        `🎯 CTO: execution status is ${ready ? 'READY' : 'LIMITED'}, Founder.`,
        `State: ${ready ? 'READY' : 'LIMITED'}`,
        `Commit: ${commitEnabled ? 'enabled' : 'disabled'}`,
        `Push: ${pushEnabled ? 'enabled' : 'disabled'}`,
        `GitHub token: ${githubReady ? 'present' : 'missing'}`,
        `Fixes remaining today: ${limit.remaining}/${limit.limit}`
      ].join('\n');
    }

    case 'execution_history':
      return [
        '🎯 CTO: Recent execution history, Founder.',
        ...formatExecutionHistory(5)
      ].join('\n');

    case 'memory':
      return formatFounderMemorySummary(readFounderMemory());

    case 'focus':
      return [
        `Founder, focus set: ${details.focusTopic}`,
        ...metricProvenanceLines(state, 'health', `${healthIcon} Health`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        '',
        'Most relevant current issue',
        `\u2022 ${compactIssue(findFocusedIssue(state, details.focusTopic) || state.sections.unresolved[0])}`
      ].join('\n');

    case 'malformed':
    case 'conversational_fallback':
      return [
        'Founder, quick CTO update',
        ...metricProvenanceLines(state, 'health', `${healthIcon} Health`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        '',
        'Active risks',
        ...linesOrFallback(state.sections.risks.length ? state.sections.risks : state.sections.unresolved, 'No active risk recorded right now.'),
        '',
        `\ud83c\udfaf Next: ${state.summary.nextPriority}`,
        ...fixOffer(state)
      ].join('\n');

    case 'unknown':
      return [
        'Founder, quick CTO update',
        ...metricProvenanceLines(state, 'health', `${healthIcon} Health`),
        '',
        ...metricProvenanceLines(state, 'momentum', `${momentumIcon} Momentum`),
        '',
        'Active risks',
        ...linesOrFallback(state.sections.risks.length ? state.sections.risks : state.sections.unresolved, 'No active risk recorded right now.'),
        '',
        'You can ask: coder update, reviewer risks, auditor check, or cto summary.'
      ].join('\n');

    default:
      return [
        'Founder, CTO commands',
        'status, health, momentum, latest risks, unresolved, what changed, pending approvals, keyboard health, fix limit, execution status, execution history, cto summary, school mode, focus <topic>'
      ].join('\n');
  }
}

module.exports = {
  generateResponse
};
