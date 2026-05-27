function computeProductMaturity(metrics = {}) {
  const base = [
    metrics.typingTrust,
    metrics.swipeConfidence,
    100 - Number(metrics.correctionBurden || 0),
    metrics.latencyStability,
    metrics.responsiveness,
    metrics.installReliability,
    metrics.governanceStability,
    metrics.rollbackResilience,
    100 - Number(metrics.retentionPressure || 0),
    100 - Number(metrics.creepinessRisk || 0)
  ].map((v) => Math.max(0, Math.min(100, Number(v || 0))));
  let score = Math.round(base.reduce((a, b) => a + b, 0) / base.length);
  score -= Math.min(30, Number(metrics.architectureChurn || 0) + Number(metrics.unstableExperimentation || 0));
  return Math.max(0, Math.min(100, score));
}

module.exports = { computeProductMaturity };

