function recordRegression(memory = {}, item = {}) {
  const next = { ...memory };
  next.entries = [...(next.entries || []), {
    at: new Date().toISOString(),
    subsystem: item.subsystem || 'unknown',
    cause: item.cause || 'unknown',
    rollbackUsed: Boolean(item.rollbackUsed),
    trustImpact: Number(item.trustImpact || 0)
  }].slice(-400);
  return next;
}

function summarizeRegression(memory = {}) {
  const entries = memory.entries || [];
  const bySubsystem = {};
  for (const e of entries) bySubsystem[e.subsystem] = (bySubsystem[e.subsystem] || 0) + 1;
  return { total: entries.length, bySubsystem };
}

module.exports = { recordRegression, summarizeRegression };

