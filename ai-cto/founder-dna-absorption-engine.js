const { getFounderDnaCore } = require('./founder-dna-core');
const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');

function verifyFounderDnaAbsorption(options = {}) {
  const core = getFounderDnaCore();
  const plan = buildWholeBodyConvergencePlan(options);
  const requiredDomains = {
    productNorthStar: Boolean(core.productNorthStar),
    priorityHierarchy: core.hierarchy.length >= 7,
    phaseOneRoadmap: core.phaseOnePriorities.length >= 10,
    productTaste: core.productTaste.length >= 7,
    forbiddenDrift: core.forbiddenDrift.length >= 10,
    executionDoctrine: core.executionDoctrine.length >= 6,
    privacyDoctrine: core.privacyDoctrine.length >= 5,
    convergenceDoctrine: core.convergenceDoctrine.length >= 4,
    canonicalRuntime: plan.authorities.runtime === 'MyKeyboard/ai-cto',
    donorPreserved: plan.authorities.founderDna === core.donorAuthority
  };
  const missing = Object.entries(requiredDomains)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  return {
    decision: missing.length ? 'FOUNDER_DNA_INCOMPLETE' : 'FOUNDER_DNA_ABSORBED',
    absorptionMode: core.absorptionMode,
    canonicalAuthority: core.authority,
    donorAuthority: core.donorAuthority,
    missing,
    runtimeImpact: 'NO_ROOT_OR_RUNTIME_PATH_CHANGE',
    memoryImpact: 'DOCTRINE_ABSORBED_AS_CANONICAL_STATIC_CORE_NO_STORE_MERGE',
    governanceImpact: 'DOCTRINE_AVAILABLE_TO_CANONICAL_SYSTEM_NO_ENFORCEMENT_REPLACE',
    whatsappImpact: 'SAFE_FOR_CONVERSATIONAL_REASONING',
    rollbackStrategy: 'Remove founder-dna-core consumers; donor root remains intact.'
  };
}

module.exports = { verifyFounderDnaAbsorption };
