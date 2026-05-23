const { schoolModeDigest, groupChatDailyUpdate } = require('./school-mode-policy');
const { readRoadmap } = require('./roadmap-reader');
const { logAgentAction } = require('./agent-action-log');
const { classifyRisk } = require('../scripts/execution-engine');
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
    `Fix available — risk level: ${risk.riskLevel}`,
    'Reply FIX to execute or SKIP to ignore'
  ];
}

function generateResponse(command, state, memory = {}, details = {}) {
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
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
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
        `${healthIcon} Score: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
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
        `${momentumIcon} State: ${momentum}`,
        `${healthIcon} Health: ${health}`,
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
        `${healthIcon} Repo health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
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
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
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

    case 'memory':
      return formatFounderMemorySummary(readFounderMemory());

    case 'focus':
      return [
        `Founder, focus set: ${details.focusTopic}`,
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
        '',
        'Most relevant current issue',
        `\u2022 ${compactIssue(findFocusedIssue(state, details.focusTopic) || state.sections.unresolved[0])}`
      ].join('\n');

    case 'malformed':
    case 'conversational_fallback':
      return [
        'Founder, quick CTO update',
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
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
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
        '',
        'Active risks',
        ...linesOrFallback(state.sections.risks.length ? state.sections.risks : state.sections.unresolved, 'No active risk recorded right now.'),
        '',
        'You can ask: coder update, reviewer risks, auditor check, or cto summary.'
      ].join('\n');

    default:
      return [
        'Founder, CTO commands',
        'status, health, momentum, latest risks, unresolved, what changed, pending approvals, keyboard health, cto summary, school mode, focus <topic>'
      ].join('\n');
  }
}

module.exports = {
  generateResponse
};
