function analyzeScreenshotEvidence({ candidate = {}, baseline = {} } = {}) {
  const findings = [];

  addIf(findings, {
    type: 'cramped-spacing',
    severity: gap(candidate.averageKeyGap, baseline.averageKeyGap) >= 2 ? 'MEDIUM' : 'LOW',
    measured: `averageKeyGap=${num(candidate.averageKeyGap)}px baseline=${num(baseline.averageKeyGap)}px`,
    message: 'Keyboard spacing is tighter than baseline.'
  }, gap(candidate.averageKeyGap, baseline.averageKeyGap) >= 2);

  addIf(findings, {
    type: 'edge-key-risk',
    severity: gap(candidate.edgeKeyWidth, baseline.edgeKeyWidth) >= 4 ? 'HIGH' : 'MEDIUM',
    measured: `edgeKeyWidth=${num(candidate.edgeKeyWidth)}px baseline=${num(baseline.edgeKeyWidth)}px`,
    message: 'Edge key target is smaller than baseline.'
  }, gap(candidate.edgeKeyWidth, baseline.edgeKeyWidth) >= 3);

  addIf(findings, {
    type: 'dark-mode-contrast',
    severity: Number(candidate.darkModeContrastRatio || 0) < 4.5 ? 'MEDIUM' : 'LOW',
    measured: `contrast=${num(candidate.darkModeContrastRatio)} baseline=${num(baseline.darkModeContrastRatio)}`,
    message: 'Dark mode contrast is below mature baseline or common readability target.'
  }, Number(candidate.darkModeContrastRatio || 0) < Math.min(4.5, Number(baseline.darkModeContrastRatio || 4.5)));

  addIf(findings, {
    type: 'symbol-friction',
    severity: gap(baseline.symbolToggleTravelPx, candidate.symbolToggleTravelPx) >= 40 ? 'MEDIUM' : 'LOW',
    measured: `symbolToggleTravel=${num(candidate.symbolToggleTravelPx)}px baseline=${num(baseline.symbolToggleTravelPx)}px`,
    message: 'Symbol access requires more thumb travel than baseline.'
  }, gap(baseline.symbolToggleTravelPx, candidate.symbolToggleTravelPx) >= 30);

  addIf(findings, {
    type: 'overlap-risk',
    severity: Number(candidate.overlapCount || 0) > 0 ? 'HIGH' : 'LOW',
    measured: `overlapCount=${num(candidate.overlapCount)} baseline=${num(baseline.overlapCount)}`,
    message: 'Screenshot analysis detected possible overlapping UI elements.'
  }, Number(candidate.overlapCount || 0) > Number(baseline.overlapCount || 0));

  return {
    candidateName: candidate.name || 'Aritenis current build',
    baselineName: baseline.name || 'previous stable baseline',
    status: findings.length ? 'ATTENTION_NEEDED' : 'NO_MEASURABLE_REGRESSION',
    findings,
    measured: {
      candidate: sanitizeMetrics(candidate),
      baseline: sanitizeMetrics(baseline)
    },
    privacy: {
      rawTypingStored: false,
      swipeCoordinatesStored: false,
      scriptedPhrasesOnly: true,
      cloudTelemetry: false
    }
  };
}

function formatScreenshotComparisonReport(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  return [
    '# SCREENSHOT_COMPARISON_REPORT',
    '',
    '## WHAT WAS COMPARED',
    `- Current build: ${evidence.candidateName || 'Aritenis current build'}`,
    `- Baseline: ${evidence.baselineName || 'previous stable baseline'}`,
    '',
    '## WHAT IS MEASURED',
    findings.length
      ? findings.map((finding) => `- ${finding.severity}: ${finding.type} - ${finding.measured}`).join('\n')
      : '- No measurable screenshot regression detected by current heuristics.',
    '',
    '## WHAT WAS OBSERVED',
    findings.length
      ? findings.map((finding) => `- ${finding.message}`).join('\n')
      : '- Current evidence did not cross spacing, contrast, symbol, overlap, or edge-key thresholds.',
    '',
    '## WHAT IS ONLY THEORETICAL',
    '- Human typing feel is inferred from screenshots and scripted flows, not direct human touch sensation.',
    '- Gboard or SwiftKey comparison requires manually supplied baseline screenshots in CI.',
    '',
    '## REGRESSION RISK',
    '- Analysis-only. No runtime code is modified by this report.',
    ''
  ].join('\n');
}

function sanitizeMetrics(input = {}) {
  return {
    width: bounded(input.width),
    height: bounded(input.height),
    averageKeyWidth: bounded(input.averageKeyWidth),
    averageKeyGap: bounded(input.averageKeyGap),
    darkModeContrastRatio: Number(input.darkModeContrastRatio || 0),
    symbolToggleTravelPx: bounded(input.symbolToggleTravelPx),
    edgeKeyWidth: bounded(input.edgeKeyWidth),
    overlapCount: bounded(input.overlapCount)
  };
}

function addIf(findings, finding, condition) {
  if (condition) findings.push(finding);
}

function gap(candidate, baseline) {
  return Number(baseline || 0) - Number(candidate || 0);
}

function bounded(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(100000, Math.round(number));
}

function num(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

module.exports = {
  analyzeScreenshotEvidence,
  formatScreenshotComparisonReport
};
