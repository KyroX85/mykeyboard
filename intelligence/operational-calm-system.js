function evaluateOperationalCalm({ urgencyInflation = 0, rewriteNoise = 0, proposalNoise = 0 } = {}) {
  const noise = urgencyInflation + rewriteNoise + proposalNoise;
  return {
    calmScore: Math.max(0, 100 - noise),
    suppressModernizationPressure: noise > 40
  };
}

module.exports = { evaluateOperationalCalm };

