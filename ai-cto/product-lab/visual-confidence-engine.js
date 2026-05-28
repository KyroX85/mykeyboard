function estimateVisualConfidence(evidence = {}) {
  const quality = evidence.quality || {};
  let score = 15;
  const notes = [];

  if (quality.screenshotCount >= 3) score += 25;
  else if (quality.screenshotCount >= 1) {
    score += 10;
    notes.push('visual evidence weak: only one screenshot available');
  } else {
    notes.push('visual evidence weak: no screenshot count supplied');
  }
  if (quality.hasBaseline) score += 20;
  else notes.push('visual evidence weak: no baseline comparison');
  if (quality.resolutionMatched) score += 15;
  else notes.push('visual evidence weak: resolution mismatch may distort spacing judgment');
  if (quality.annotated) score += 10;
  else {
    score -= 5;
    notes.push('visual evidence weak: no annotated comparison yet');
  }
  if (quality.deviceWidthKnown) score += 10;

  score = clamp(score, 0, 100);
  return {
    score,
    level: score >= 75 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW',
    ambiguity: clamp(100 - score, 0, 100),
    notes
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

module.exports = { estimateVisualConfidence };
