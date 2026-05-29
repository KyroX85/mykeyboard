const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function resolveGovernanceAuthority(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    currentAuthority: 'MyKeyboard/ai-cto product-governance and governance-consistency modules',
    donorAuthority: 'C:\\Users\\ADMIN\\ai-cto\\governance',
    intendedAuthority: 'Single canonical governance inside MyKeyboard/ai-cto after semantic transplant',
    duplicateRisks: plan.duplicates.filter((item) => /governance|uncertainty|reality|execution/i.test(item.name)),
    decision: 'MAP_ONLY_DO_NOT_REPLACE'
  };
}

module.exports = { resolveGovernanceAuthority };
