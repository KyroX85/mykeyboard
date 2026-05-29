const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');
const { enforceSingleAuthority } = require('./single-authority-enforcer');

function assessBodyCoherence(options = {}) {
  const plan = buildWholeBodyConvergencePlan(options);
  const authority = enforceSingleAuthority(options);
  return {
    body: 'ONE_CANONICAL_OPERATIONAL_BODY_DECLARED',
    runtimeAuthority: authority.runtimeAuthority,
    governanceAuthority: authority.governanceAuthority,
    memoryAuthority: authority.memoryAuthority,
    datasetAuthority: authority.datasetAuthority,
    shadowRetirementStatus: 'NOT_YET_SAFE',
    confidence: plan.convergenceConfidence
  };
}

module.exports = { assessBodyCoherence };
