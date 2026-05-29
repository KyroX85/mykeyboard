const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function preserveFounderDna(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    donorRoot: plan.roots.donorRoot,
    policy: 'READ_ONLY_DONOR_UNTIL_FOUNDER_APPROVES_TRANSPLANT',
    founderDnaSystems: plan.founderDna,
    overwriteAllowed: false
  };
}

module.exports = { preserveFounderDna };
