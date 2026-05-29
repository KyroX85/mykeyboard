const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function resolveMemoryAuthority(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    currentAuthority: 'MyKeyboard/ai-cto JSON operational state and memory files',
    donorAuthority: 'C:\\Users\\ADMIN\\ai-cto\\memory and reports',
    intendedAuthority: 'One canonical memory authority inside MyKeyboard/ai-cto after staged transplant',
    duplicateRisks: plan.duplicates.filter((item) => /memory|state|brain|regression|rollback/i.test(item.name)),
    decision: 'PRESERVE_DONOR_MEMORY_DO_NOT_OVERWRITE'
  };
}

module.exports = { resolveMemoryAuthority };
