function estimateTrustDecay({
  correctionBursts = 0,
  repeatedFrictionDays = 0,
  visualDiscomfort = 0,
  regressions = 0,
  latencySpikes = 0
} = {}) {
  const drivers = [];
  let score = 0;
  if (repeatedFrictionDays > 0) {
    score += repeatedFrictionDays * 12;
    drivers.push('recurring friction');
  }
  if (correctionBursts > 0) {
    score += correctionBursts * 6;
    drivers.push('correction burden');
  }
  if (visualDiscomfort > 0) {
    score += visualDiscomfort * 5;
    drivers.push('visual discomfort');
  }
  if (latencySpikes > 0) {
    score += latencySpikes * 7;
    drivers.push('responsiveness instability');
  }
  if (regressions > 0) {
    score += regressions * 18;
    drivers.push('regression memory');
  }
  return {
    score: Math.min(100, Math.round(score)),
    level: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : score > 0 ? 'LOW-MEDIUM' : 'LOW',
    drivers: [...new Set(drivers)]
  };
}

module.exports = { estimateTrustDecay };
