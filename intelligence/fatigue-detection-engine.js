function detectOperationalFatigue({ edits = 0, refactors = 0, proposals = 0, instability = 0 } = {}) {
  const score = Math.min(100, edits * 6 + refactors * 8 + proposals * 4 + instability);
  return {
    fatigueScore: score,
    shouldSlowDown: score >= 60,
    mode: score >= 80 ? 'PAUSE_MUTATION' : score >= 60 ? 'SLOW_ITERATION' : 'NORMAL'
  };
}

module.exports = { detectOperationalFatigue };

