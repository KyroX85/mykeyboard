const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');

function verifyNervousSystemIntegrity(options = {}) {
  const plan = buildWholeBodyConvergencePlan(options);
  const failures = [];
  if (plan.executionRootImpact !== 'UNCHANGED') failures.push('execution root changed');
  if (plan.workflowImpact !== 'UNCHANGED') failures.push('workflow impact detected');
  if (plan.whatsappImpact !== 'UNCHANGED') failures.push('whatsapp impact detected');
  if (plan.retirementSafety.canRetireNow) failures.push('shadow retirement incorrectly enabled');
  return {
    decision: failures.length ? 'INTEGRITY_FAILED' : 'INTEGRITY_HELD',
    failures,
    confidence: plan.convergenceConfidence
  };
}

module.exports = { verifyNervousSystemIntegrity };
