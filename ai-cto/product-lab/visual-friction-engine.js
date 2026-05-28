const { analyzeScreenshotEvidence } = require('./screenshot-analysis/screenshot-diff-engine');

function classifyVisualFriction(screenshotEvidence = {}) {
  const evidence = analyzeScreenshotEvidence({
    candidate: screenshotEvidence.candidate || {},
    baseline: screenshotEvidence.baseline || {}
  });
  const likelySubsystems = likelySubsystemsFor(evidence.findings);

  return {
    ...evidence,
    source: screenshotEvidence.source || 'screenshot',
    likelySubsystems,
    trustImpact: trustImpactFor(evidence.findings),
    safestFix: safestFixFor(evidence.findings),
    visualSummary: evidence.findings.map((finding) => finding.message)
  };
}

function likelySubsystemsFor(findings = []) {
  const out = new Set();
  for (const finding of findings) {
    if (['cramped-spacing', 'edge-key-risk', 'overlap-risk'].includes(finding.type)) {
      out.add('KeyboardSizingProfile.kt');
    }
    if (finding.type === 'symbol-friction') {
      out.add('KeyboardSymbols.kt');
      out.add('KeyboardSizingProfile.kt');
    }
    if (finding.type === 'dark-mode-contrast') {
      out.add('key_bg.xml');
      out.add('KeyboardSizingProfile.kt');
    }
  }
  return [...out];
}

function trustImpactFor(findings = []) {
  if (findings.some((finding) => finding.severity === 'HIGH')) return 'MEDIUM-HIGH';
  if (findings.length >= 2) return 'MEDIUM';
  if (findings.length === 1) return 'LOW-MEDIUM';
  return 'LOW';
}

function safestFixFor(findings = []) {
  if (findings.some((finding) => finding.type === 'edge-key-risk')) {
    return 'Small reversible edge padding and minimum key-width adjustment.';
  }
  if (findings.some((finding) => finding.type === 'symbol-friction')) {
    return 'One-variable symbol spacing or access-distance experiment.';
  }
  if (findings.some((finding) => finding.type === 'dark-mode-contrast')) {
    return 'Bounded contrast token adjustment with screenshot comparison.';
  }
  return 'No patch; keep observing.';
}

module.exports = {
  classifyVisualFriction
};
