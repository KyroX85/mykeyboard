function scoreDecision(options = []) {
  return options.map((opt) => {
    const w = opt.weights || {};
    const score =
      (w.userFriction || 0) * 7 +
      (w.retentionPressure || 0) * 6 +
      (w.regressionHistory || 0) * 5 +
      (w.stabilityEvidence || 0) * 4 +
      (w.latencyEvidence || 0) * 3 +
      (w.founderRequest || 0) * 2 +
      (w.architectureElegance || 0) * 1;
    return { ...opt, score };
  }).sort((a, b) => b.score - a.score);
}

module.exports = { scoreDecision };

