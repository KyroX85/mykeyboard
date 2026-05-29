const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function preventDuplicateRuntime(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    decision: 'ONE_RUNTIME_AUTHORITY_ONLY',
    runtimeAuthority: plan.runtimeAuthority,
    donorRuntimeStatus: 'DONOR_MUST_NOT_EXECUTE',
    dangerousCandidates: plan.candidates.filter((candidate) => candidate.classification === 'RUNTIME_CRITICAL' || candidate.classification === 'DANGEROUS_DUPLICATE')
  };
}

module.exports = { preventDuplicateRuntime };
