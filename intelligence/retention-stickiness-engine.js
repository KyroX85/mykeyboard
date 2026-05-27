function computeRetentionStickiness(input = {}) {
  const trust = Number(input.trustPersistence || 0);
  const friction = Number(input.frictionReduction || 0);
  const confidence = Number(input.typingConfidence || 0);
  const continuity = Number(input.workflowContinuity || 0);
  const usefulness = Number(input.usefulnessConsistency || 0);
  const interruptions = Number(input.interruptionReduction || 0);
  const score = Math.round((trust + friction + confidence + continuity + usefulness + interruptions) / 6);
  return { score: Math.max(0, Math.min(100, score)) };
}

module.exports = { computeRetentionStickiness };

