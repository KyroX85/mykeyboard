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

function generateResponse(command, state, memory = {}, details = {}) {
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  const momentum = state.momentum || 'UNKNOWN';
  const generatedAt = state.generatedAt || 'not recorded yet';
  const healthIcon = state.healthScore == null ? '\u26aa' : state.healthScore >= 80 ? '\u2705' : state.healthScore >= 60 ? '\u26a0\ufe0f' : '\ud83d\udea8';
  const momentumIcon = momentum === 'STABLE' ? '\u2705' : momentum === 'STALLED' ? '\ud83d\udea8' : '\u26a0\ufe0f';
  const heartbeat = state.workflowFreshness && state.workflowFreshness.stale
    ? [`\ud83d\udea8 Heartbeat: ${state.workflowFreshness.message}`, '']
    : [];

  switch (command) {
    case 'status':
      return [
        'Founder Sir, CTO status',
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
        'Founder Sir, engineering health',
        `${healthIcon} Score: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
        '',
        'Pressure points',
        ...linesOrFallback(state.sections.risks, 'No critical risk listed in the latest report.')
      ].join('\n');

    case 'risks':
      return [
        'Founder Sir, latest risks',
        ...linesOrFallback(state.sections.risks, 'No new critical risk listed in the latest report.')
      ].join('\n');

    case 'momentum':
      return [
        'Founder Sir, momentum',
        `${momentumIcon} State: ${momentum}`,
        `${healthIcon} Health: ${health}`,
        '',
        'Repeated failures',
        ...linesOrFallback(state.sections.repeatedFailures, 'No recurring failure pattern detected yet.')
      ].join('\n');

    case 'latest_fixes':
      return [
        'Founder Sir, latest fixes',
        ...linesOrFallback(state.sections.completedFixes, 'No completed fix was recorded in the latest run.')
      ].join('\n');

    case 'unresolved':
    case 'pending_issues':
      return [
        'Founder Sir, unresolved issues',
        ...linesOrFallback(state.sections.unresolved, 'No unresolved issue is recorded in the latest state.')
      ].join('\n');

    case 'what_changed':
      return [
        'Founder Sir, what changed',
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
        'Founder Sir, next priorities',
        ...linesOrFallback(state.sections.nextPriority, 'No next priority is recorded yet.'),
        '',
        'Safest safe move',
        ...linesOrFallback(state.sections.safestOpportunity, 'No safe improvement opportunity is recorded yet.')
      ].join('\n');

    case 'approvals':
      return [
        'Founder Sir, pending approvals',
        ...linesOrFallback(state.sections.approvals, 'No approval item is pending in the latest report.')
      ].join('\n');

    case 'keyboard_health':
      return [
        'Founder Sir, keyboard health',
        `${healthIcon} Repo health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
        '',
        'Keyboard risk focus',
        ...linesOrFallback(
          state.sections.unresolved.filter((item) => /keyboard|predictor|input|ime|swipe|gesture/i.test(item)),
          'No keyboard-specific issue is isolated in the latest report.'
        )
      ].join('\n');

    case 'cto_summary':
    case 'weekly_summary':
      return [
        'Founder Sir, CTO summary',
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
        `\ud83e\udde0 Last focus: ${memory.lastRequestedFocusArea || 'none'}`,
        `\ud83c\udfaf Next: ${state.summary.nextPriority}`,
        '',
        'Top risk',
        `\u2022 ${state.summary.topRisk}`
      ].join('\n');

    case 'focus':
      return [
        `Founder Sir, focus set: ${details.focusTopic}`,
        `${healthIcon} Health: ${health}`,
        `${momentumIcon} Momentum: ${momentum}`,
        '',
        'Most relevant current issue',
        `\u2022 ${compactIssue(findFocusedIssue(state, details.focusTopic) || state.sections.unresolved[0])}`
      ].join('\n');

    case 'malformed':
      return [
        'Founder Sir, I need a CTO command.',
        'Use: status, health, momentum, latest risks, unresolved, what changed, pending approvals, keyboard health, cto summary, or focus <topic>.'
      ].join('\n');

    case 'unknown':
      return [
        'Founder Sir, I did not recognize that command.',
        'Supported: status, health, momentum, latest risks, unresolved, what changed, pending approvals, keyboard health, cto summary, focus <topic>.'
      ].join('\n');

    default:
      return [
        'Founder Sir, CTO commands',
        'status, health, momentum, latest risks, unresolved, what changed, pending approvals, keyboard health, cto summary, focus <topic>'
      ].join('\n');
  }
}

module.exports = {
  generateResponse
};
