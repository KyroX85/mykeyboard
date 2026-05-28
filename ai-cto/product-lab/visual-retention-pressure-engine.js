function computeVisualRetentionPressure(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  let score = 0;
  const drivers = new Set();

  for (const finding of findings) {
    score += finding.severity === 'HIGH' ? 30 : finding.severity === 'MEDIUM' ? 20 : 10;
    if (finding.type === 'edge-key-risk') drivers.add('thumb confidence');
    if (finding.type === 'cramped-spacing') drivers.add('typing rhythm');
    if (finding.type === 'symbol-friction') drivers.add('symbol ergonomics');
    if (finding.type === 'dark-mode-contrast') drivers.add('visual comfort');
    if (finding.type === 'overlap-risk') drivers.add('input predictability');
  }

  return {
    score: Math.min(100, score),
    level: score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM-HIGH' : score >= 25 ? 'MEDIUM' : findings.length ? 'LOW-MEDIUM' : 'LOW',
    drivers: [...drivers]
  };
}

module.exports = {
  computeVisualRetentionPressure
};
