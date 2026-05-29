const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function planShadowGovernanceElimination(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    decision: 'IDENTIFY_ONLY_NO_DELETE',
    sourceAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    shadowGovernance: plan.candidates.filter((candidate) => /governance|policy|preservation|autonomy/i.test(candidate.source)),
    safeMethod: 'Translate stronger founder rules into canonical governance proposals after tests, not direct replacement.'
  };
}

module.exports = { planShadowGovernanceElimination };
