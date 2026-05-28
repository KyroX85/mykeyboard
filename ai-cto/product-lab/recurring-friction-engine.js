function detectRecurringFriction(visualMemory = {}) {
  const issues = Array.isArray(visualMemory.recurringIssues) ? visualMemory.recurringIssues : [];
  const highest = issues[0] || { issue: 'none', count: 0, severity: 'LOW', messages: [] };
  const cycles = Array.isArray(visualMemory.cycles) ? visualMemory.cycles.length : 0;
  const level = highest.count >= 3 ? 'MEDIUM-HIGH' : highest.count >= 2 ? 'MEDIUM' : highest.count === 1 ? 'LOW' : 'NONE';
  return {
    level,
    highest,
    issues,
    cyclesObserved: cycles,
    summary: highest.count > 0
      ? `${highest.issue} observed in ${highest.count} screenshot cycles`
      : 'no recurring visual friction detected'
  };
}

module.exports = { detectRecurringFriction };
