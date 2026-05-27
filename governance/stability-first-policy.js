function applyStabilityFirstPolicy({ evidenceStrength = 0, trustRisk = 0, rollbackComplexity = 0 } = {}) {
  if (evidenceStrength < 65) return { decision: 'NO_CHANGE', reason: 'weak_evidence' };
  if (trustRisk > 35) return { decision: 'NO_CHANGE', reason: 'trust_risk_too_high' };
  if (rollbackComplexity > 60) return { decision: 'NO_CHANGE', reason: 'rollback_too_complex' };
  return { decision: 'ALLOW_SMALL_CHANGE', reason: null };
}

module.exports = { applyStabilityFirstPolicy };

