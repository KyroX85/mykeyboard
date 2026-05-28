function buildScreenshotTimeline(visualMemory = {}) {
  const cycles = Array.isArray(visualMemory.cycles) ? visualMemory.cycles : [];
  const first = cycles[0] || {};
  const last = cycles[cycles.length - 1] || {};
  const densityDrift = computeDrift(first.metrics || {}, last.metrics || {});
  const edgeKeyConfidenceTrend = trendFor(first.metrics?.edgeKeyWidth, last.metrics?.edgeKeyWidth, true);
  const darkModeReadabilityTrend = trendFor(first.metrics?.darkModeContrastRatio, last.metrics?.darkModeContrastRatio, false);
  return {
    cyclesObserved: cycles.length,
    densityDrift,
    edgeKeyConfidenceTrend,
    darkModeReadabilityTrend,
    recurringIssues: visualMemory.recurringIssues || []
  };
}

function computeDrift(first = {}, last = {}) {
  const gapDrift = Number(first.averageKeyGap || 0) - Number(last.averageKeyGap || 0);
  const widthDrift = Number(first.averageKeyWidth || 0) - Number(last.averageKeyWidth || 0);
  const currentDensityRisk =
    Math.max(0, 5 - Number(last.averageKeyGap || 0)) * 6 +
    Math.max(0, 42 - Number(last.averageKeyWidth || 0)) * 3;
  return {
    score: Math.max(0, Math.round(gapDrift * 5 + widthDrift * 3 + currentDensityRisk)),
    direction: gapDrift > 0 || widthDrift > 0 || currentDensityRisk > 0 ? 'DENSER' : 'STABLE'
  };
}

function trendFor(first, last, lowerIsWorse) {
  if (first === undefined || last === undefined) return 'UNKNOWN';
  if (Number(first) === Number(last)) return 'STABLE';
  const degraded = lowerIsWorse ? Number(last) < Number(first) : Number(last) < Number(first);
  return degraded ? 'DEGRADING' : 'IMPROVING';
}

module.exports = { buildScreenshotTimeline };
