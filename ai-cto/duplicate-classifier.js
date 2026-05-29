const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function classifyDuplicateSystems(options = {}) {
  return buildTransplantationPlan(options).duplicates;
}

module.exports = { classifyDuplicateSystems };
