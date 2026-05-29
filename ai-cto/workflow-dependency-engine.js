const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function mapWorkflowDependencies(options = {}) {
  return buildTransplantationPlan(options).runtimeActivation.workflowExecution;
}

module.exports = { mapWorkflowDependencies };
