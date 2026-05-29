const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function planMemoryConvergence(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    decision: 'MEMORY_PERSISTENCE_FROZEN',
    sourceAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    safeMethod: 'Transplant product philosophy as static reasoning rules; do not merge JSON stores.',
    splitBrainRisk: 'HIGH if donor memory files become writable authority.',
    proof: plan.proof
  };
}

module.exports = { planMemoryConvergence };
