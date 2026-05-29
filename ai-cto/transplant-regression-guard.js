const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function guardTransplantRegression(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  const blocked = [];
  if (!plan.proof || plan.proof.decision !== 'RUNTIME_SAFE_FOR_STRATEGY_ONLY') blocked.push('runtime proof missing');
  if (plan.proof.npmCommandBreak) blocked.push('npm command break');
  if (plan.proof.workflowDependencyBreak) blocked.push('workflow dependency break');
  if (plan.proof.whatsappActivationBreak) blocked.push('whatsapp activation break');
  if (plan.proof.governanceAuthorityConflict) blocked.push('governance authority conflict');
  if (plan.proof.splitBrainMemoryCreation) blocked.push('split-brain memory creation');

  return {
    decision: blocked.length ? 'BLOCK_TRANSPLANT' : 'ALLOW_STRATEGY_ONLY_TRANSPLANT',
    blocked,
    runtimeBreakProof: plan.proof,
    rollbackStrategy: 'Remove additive modules and reports; no runtime path restoration required.'
  };
}

module.exports = { guardTransplantRegression };
