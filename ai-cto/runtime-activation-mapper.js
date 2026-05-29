const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function mapRuntimeActivation(options = {}) {
  return buildTransplantationPlan(options).runtimeActivation;
}

module.exports = { mapRuntimeActivation };
