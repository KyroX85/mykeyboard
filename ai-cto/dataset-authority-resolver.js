const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function resolveDatasetAuthority(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    currentAuthority: 'MyKeyboard/ai-cto product-evidence-archive.json and Product Lab reports',
    donorAuthority: 'C:\\Users\\ADMIN\\ai-cto\\datasets and database',
    intendedAuthority: 'One dataset authority after privacy verification and founder approval',
    duplicateRisks: plan.founderDna.filter((item) => /dataset|database|ingestion|product-intelligence/i.test(item.file)),
    decision: 'VERIFY_PRIVACY_BEFORE_TRANSPLANT'
  };
}

module.exports = { resolveDatasetAuthority };
