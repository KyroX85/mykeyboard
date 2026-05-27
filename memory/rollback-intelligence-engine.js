function scoreRollbackOptions(options = []) {
  return options.map((o) => {
    const confidence = Math.max(0, 100 - Number(o.blastRadius || 0) * 10 - Number(o.unknowns || 0) * 8);
    return { ...o, rollbackConfidence: confidence };
  }).sort((a, b) => b.rollbackConfidence - a.rollbackConfidence);
}

module.exports = { scoreRollbackOptions };

