function stewardshipPosture({ lastFounderInteractionAt = null, now = new Date().toISOString() } = {}) {
  const daysAbsent = daysBetween(lastFounderInteractionAt, now);
  const mode = daysAbsent >= 30 ? 'PRESERVATION_ONLY' : daysAbsent >= 7 ? 'GUARDED' : 'ACTIVE';
  return {
    mode,
    daysAbsent,
    allowed: mode === 'ACTIVE'
      ? ['scan', 'report', 'analysis', 'proposal', 'low-risk execution']
      : mode === 'GUARDED'
        ? ['scan', 'report', 'analysis', 'proposal']
        : ['scan', 'report', 'analysis'],
    blocked: mode === 'ACTIVE'
      ? ['high-risk execution']
      : mode === 'GUARDED'
        ? ['commits without review', 'pushes without review', 'product hot-path edits']
        : ['execution', 'commits', 'pushes', 'product edits', 'experiments']
  };
}

function daysBetween(start, end) {
  if (!start) return 999;
  const first = Date.parse(start);
  const second = Date.parse(end);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return 999;
  return Math.max(0, Math.floor((second - first) / (24 * 60 * 60 * 1000)));
}

module.exports = {
  stewardshipPosture
};
