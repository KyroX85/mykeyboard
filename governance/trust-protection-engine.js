function evaluateTrustRisk({ latencyRisk = 0, swipeRisk = 0, correctionRisk = 0, responsivenessRisk = 0, feelRisk = 0 } = {}) {
  const score = Math.min(100, latencyRisk + swipeRisk + correctionRisk + responsivenessRisk + feelRisk);
  const decision = score >= 70 ? 'BLOCK' : score >= 45 ? 'SANDBOX' : 'ALLOW';
  return { score, decision };
}

module.exports = { evaluateTrustRisk };

