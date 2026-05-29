const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function preserveFounderDnaForConvergence(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    donorAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    preservationMode: 'READ_ONLY_DONOR_AND_SEMANTIC_TRANSLATION',
    founderDnaSystems: plan.safeCandidates,
    overwriteAllowed: false,
    deletionAllowed: false
  };
}

module.exports = { preserveFounderDnaForConvergence };
