const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function planSafeGovernanceMerge(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    decision: 'DO_NOT_MERGE_GOVERNANCE_YET',
    sourceAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    allowedNow: 'Map founder governance philosophy only.',
    forbiddenNow: 'Replacing active governance enforcement or preservation gates.',
    transplantRisk: 'HIGH',
    proof: plan.proof
  };
}

module.exports = { planSafeGovernanceMerge };
