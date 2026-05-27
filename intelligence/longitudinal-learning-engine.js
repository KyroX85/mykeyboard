function analyzeLongitudinalSeries(series = []) {
  const points = Array.isArray(series) ? series : [];
  const retentionDelta = delta(points.map((p) => p.retention || 0));
  const trustDelta = delta(points.map((p) => p.trust || 0));
  const correctionDelta = delta(points.map((p) => p.corrections || 0));
  return {
    retentionDecay: retentionDelta < 0 ? Math.abs(retentionDelta) : 0,
    trustStability: trustDelta,
    correctionTrend: correctionDelta,
    durabilityRisk: retentionDelta < 0 || trustDelta < 0 ? 'ELEVATED' : 'LOW'
  };
}

function delta(values) {
  if (values.length < 2) return 0;
  return Number(values[values.length - 1] || 0) - Number(values[0] || 0);
}

module.exports = { analyzeLongitudinalSeries };

