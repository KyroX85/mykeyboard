const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function planSafeTransplant(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    decision: 'STRATEGY_ONLY',
    canMoveFiles: false,
    canRewriteImports: false,
    canTouchRuntime: false,
    safeTransplantOrder: plan.safeTransplantOrder,
    migrationConfidence: plan.migrationConfidence
  };
}

module.exports = { planSafeTransplant };
