const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');

function stabilizeRuntimeIdentity(options = {}) {
  const plan = buildWholeBodyConvergencePlan(options);
  return {
    identity: 'MyKeyboard/ai-cto',
    packageJsonImpact: 'UNCHANGED',
    workflowImpact: plan.workflowImpact,
    whatsappImpact: plan.whatsappImpact,
    androidRuntimeImpact: 'UNCHANGED',
    reason: 'Paths are part of runtime identity; convergence must not relocate them.'
  };
}

module.exports = { stabilizeRuntimeIdentity };
