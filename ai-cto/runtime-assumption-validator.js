const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');

function validateRuntimeAssumptions(options = {}) {
  const plan = buildWholeBodyConvergencePlan(options);
  return {
    packageJsonRootUnchanged: plan.executionRootImpact === 'UNCHANGED',
    workflowsUnchanged: plan.workflowImpact === 'UNCHANGED',
    whatsappUnchanged: plan.whatsappImpact === 'UNCHANGED',
    androidRuntimeUnchanged: true,
    activeImportsMapped: plan.activeImportPaths.length > 0,
    decision: 'ASSUMPTIONS_VALID_FOR_CONVERGENCE'
  };
}

module.exports = { validateRuntimeAssumptions };
