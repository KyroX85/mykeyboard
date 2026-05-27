function defineMicroExperiment(spec = {}) {
  const blastRadius = Number(spec.blastRadius || 0);
  return {
    valid: Boolean(spec.variable && spec.hypothesis && spec.rollbackTrigger),
    oneVariable: Array.isArray(spec.variables) ? spec.variables.length === 1 : Boolean(spec.variable),
    blastRadius,
    maxAllowedDegradation: Number(spec.maxAllowedDegradation || 2),
    expectedRetentionImpact: Number(spec.expectedRetentionImpact || 0),
    expectedTrustImpact: Number(spec.expectedTrustImpact || 0)
  };
}

module.exports = { defineMicroExperiment };

