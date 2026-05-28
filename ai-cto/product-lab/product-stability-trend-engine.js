function computeProductStabilityTrend({ timeline = {}, regressionHistory = [], activeExperiments = 0 } = {}) {
  const openRegressions = regressionHistory.filter((item) => item.status !== 'closed').length;
  const recurringCount = (timeline.recurringIssues || []).filter((issue) => issue.count >= 2).length;
  const densityDrift = timeline.densityDrift?.score || 0;
  const instabilityScore = openRegressions * 20 + recurringCount * 15 + densityDrift + Number(activeExperiments || 0) * 12;
  return {
    score: Math.min(100, Math.round(instabilityScore)),
    trend: instabilityScore >= 70
      ? 'UNSTABLE'
      : recurringCount > 0 || openRegressions > 0
        ? 'STABLE_WITH_RECURRING_FRICTION'
        : 'HEALTHY',
    reasons: reasons({ openRegressions, recurringCount, densityDrift, activeExperiments })
  };
}

function reasons({ openRegressions, recurringCount, densityDrift, activeExperiments }) {
  const out = [];
  if (openRegressions) out.push(`${openRegressions} open regression(s)`);
  if (recurringCount) out.push(`${recurringCount} recurring UX issue(s)`);
  if (densityDrift > 0) out.push('visual density drift');
  if (activeExperiments > 0) out.push('active experiment pressure');
  return out;
}

module.exports = { computeProductStabilityTrend };
