const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');

function enforceSingleAuthority(options = {}) {
  const plan = buildWholeBodyConvergencePlan(options);
  return {
    decision: 'DECLARE_SINGLE_CANONICAL_AUTHORITY',
    runtimeAuthority: plan.authorities.runtime,
    governanceAuthority: plan.authorities.governance,
    memoryAuthority: plan.authorities.memory,
    datasetAuthority: plan.authorities.dataset,
    executionRootImpact: plan.executionRootImpact,
    canRetireShadowsNow: false
  };
}

module.exports = { enforceSingleAuthority };
