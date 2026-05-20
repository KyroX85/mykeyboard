function linesOrFallback(items, fallback) {
  if (!items || items.length === 0) return [fallback];
  return items.map((item) => `- ${item}`);
}

function formatValidation(validation) {
  if (!validation || validation.length === 0) {
    return ['- No Android validation result is available yet.'];
  }

  return validation.map((item) => {
    const status = String(item.status || 'unknown').toUpperCase();
    return `- ${item.task}: ${status}`;
  });
}

function generateResponse(command, state) {
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  const momentum = state.momentum || 'UNKNOWN';
  const generatedAt = state.generatedAt || 'not recorded yet';

  switch (command) {
    case 'status':
      return [
        'Founder Sir, CTO status:',
        `Health: ${health}`,
        `Momentum: ${momentum}`,
        `Last analysis: ${generatedAt}`,
        '',
        'Android validation:',
        ...formatValidation(state.validation),
        '',
        `Next priority: ${state.sections.nextPriority[0] || 'No priority recorded yet.'}`
      ].join('\n');

    case 'health':
      return [
        'Founder Sir, current engineering health:',
        `Score: ${health}`,
        `Momentum: ${momentum}`,
        '',
        'Main pressure points:',
        ...linesOrFallback(state.sections.risks, 'No critical risk listed in the latest report.')
      ].join('\n');

    case 'risks':
      return [
        'Founder Sir, current risks:',
        ...linesOrFallback(state.sections.risks, 'No new critical risk listed in the latest report.')
      ].join('\n');

    case 'momentum':
      return [
        'Founder Sir, momentum summary:',
        `Momentum: ${momentum}`,
        `Health: ${health}`,
        '',
        'Repeated failures:',
        ...linesOrFallback(state.sections.repeatedFailures, 'No recurring failure pattern detected yet.')
      ].join('\n');

    case 'latest_fixes':
      return [
        'Founder Sir, latest completed fixes:',
        ...linesOrFallback(state.sections.completedFixes, 'No completed fix was recorded in the latest run.')
      ].join('\n');

    case 'pending_issues':
      return [
        'Founder Sir, pending engineering issues:',
        ...linesOrFallback(state.sections.unresolved, 'No unresolved issue is recorded in the latest state.')
      ].join('\n');

    case 'next_priorities':
      return [
        'Founder Sir, recommended next priority:',
        ...linesOrFallback(state.sections.nextPriority, 'No next priority is recorded yet.'),
        '',
        'Safest improvement opportunity:',
        ...linesOrFallback(state.sections.safestOpportunity, 'No safe improvement opportunity is recorded yet.')
      ].join('\n');

    case 'approvals':
      return [
        'Founder Sir, pending approvals:',
        ...linesOrFallback(state.sections.approvals, 'No approval item is pending in the latest report.')
      ].join('\n');

    case 'weekly_summary':
      return [
        'Founder Sir, weekly CTO summary:',
        `Current health: ${health}`,
        `Current momentum: ${momentum}`,
        '',
        'Files becoming unstable:',
        ...linesOrFallback(state.sections.unstableFiles, 'No unstable file trend is available yet.'),
        '',
        'Recurring failures:',
        ...linesOrFallback(state.sections.repeatedFailures, 'No recurring failure pattern detected yet.')
      ].join('\n');

    default:
      return [
        'Founder Sir, I can answer these CTO commands:',
        'status, health, risks, momentum, latest fixes, pending issues, next priorities, approvals, weekly summary'
      ].join('\n');
  }
}

module.exports = {
  generateResponse
};
