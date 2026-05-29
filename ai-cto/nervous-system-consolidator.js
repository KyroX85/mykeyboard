const { buildTransplantationPlan, renderReport } = require('./transplantation-orchestrator');

function consolidateNervousSystem(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    decision: 'DO_NOT_CONSOLIDATE_FILES_YET',
    report: renderReport('Brain Unification Strategy', plan),
    plan
  };
}

module.exports = { consolidateNervousSystem };
