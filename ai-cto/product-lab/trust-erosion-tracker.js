function trackTrustErosion({ recurringFriction = {}, productSignals = {} } = {}) {
  const drivers = [];
  let score = 0;
  if ((recurringFriction.highest?.count || 0) >= 2) {
    score += recurringFriction.highest.count * 15;
    drivers.push('recurring visual friction');
  }
  if (Number(productSignals.trustErosion || 0) > 0) {
    score += Number(productSignals.trustErosion) * 6;
    drivers.push('trust erosion signal');
  }
  if (Number(productSignals.visualDiscomfort || 0) > 0) {
    score += Number(productSignals.visualDiscomfort) * 5;
    drivers.push('visual discomfort');
  }
  if (Number(productSignals.correctionBurden || 0) > 0) {
    score += Number(productSignals.correctionBurden) * 4;
    drivers.push('correction burden');
  }
  score = Math.min(100, Math.round(score));
  return {
    score,
    level: score >= 70 ? 'HIGH' : score >= 40 ? 'MODERATE' : score > 0 ? 'LOW' : 'NONE',
    drivers: [...new Set(drivers)]
  };
}

module.exports = { trackTrustErosion };
