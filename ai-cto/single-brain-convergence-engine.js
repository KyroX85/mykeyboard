const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');
const { buildOperationalIdentity } = require('./operational-identity-engine');

function planSingleBrainConvergence(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    decision: 'CONVERGE_INTELLIGENCE_FIRST',
    identity: buildOperationalIdentity(),
    safeCandidates: plan.safeCandidates,
    frozenSystems: plan.frozenSystems,
    confidence: plan.migrationConfidence
  };
}

module.exports = { planSingleBrainConvergence };
