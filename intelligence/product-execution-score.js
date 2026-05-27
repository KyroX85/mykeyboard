function computeExecutionScore(input = {}) {
  let score = 70;
  score -= Number(input.architectureChurn || 0) * 2;
  score -= Number(input.rewriteBehavior || 0) * 3;
  score -= Number(input.instabilityAfterChanges || 0) * 2;
  score -= Number(input.excessiveReports || 0) * 1;
  score += Number(input.stableImprovements || 0) * 2;
  score += Number(input.successfulRollbacks || 0) * 2;
  score += Number(input.retentionPositiveExperiments || 0) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { computeExecutionScore };

