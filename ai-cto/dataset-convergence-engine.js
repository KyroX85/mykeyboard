const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function planDatasetConvergence(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    decision: 'DATASET_PERSISTENCE_FROZEN',
    sourceAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    safeMethod: 'Map dataset concepts only after privacy classification; do not move SQLite, snapshots, or logs.',
    transplantRisk: 'HIGH until privacy and import traces are complete.',
    proof: plan.proof
  };
}

module.exports = { planDatasetConvergence };
