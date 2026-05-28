function estimateExecutionConfidence({
  evidenceStrength = 0,
  visualConfidence = {},
  longitudinalConfidence = {},
  regressionFear = {},
  changeRisk = 0,
  patchSurface = {}
} = {}) {
  const evidence = clamp(evidenceStrength);
  const visual = clamp(visualConfidence.score);
  const longitudinal = clamp(longitudinalConfidence.score);
  const regression = clamp(regressionFear.score);
  const risk = clamp(changeRisk);
  const files = Number(patchSurface.files || 0);
  const lines = Number(patchSurface.lines || 0);
  const patchPenalty = Math.min(30, files * 4 + Math.ceil(lines / 20) * 3);
  const score = clamp(
    evidence * 0.45 +
    visual * 0.25 +
    longitudinal * 0.15 -
    regression * 0.12 -
    risk * 0.08 -
    patchPenalty
  );
  const classification = classify({ evidence, visual, longitudinal, regression, risk, files, lines, score });

  return {
    score,
    classification,
    statement: buildStatement({ classification, visualConfidence, longitudinalConfidence, regressionFear }),
    limits: buildLimits({ visualConfidence, longitudinalConfidence, evidence, risk })
  };
}

function classify({ evidence, visual, regression, risk, files, lines, score }) {
  if (evidence < 25 || visual < 25 || regression >= 75 || risk >= 75 || files > 3 || lines > 120) {
    return 'SPECULATIVE_DO_NOT_EXECUTE';
  }
  if (score >= 68 && regression < 35 && risk < 35 && files <= 1 && lines <= 40) {
    return 'HIGH_CONFIDENCE_SAFE';
  }
  if (score >= 28 && regression < 65 && risk < 60 && files <= 2 && lines <= 80) {
    return 'MEDIUM_CONFIDENCE_SANDBOX';
  }
  return 'LOW_CONFIDENCE_REVIEW_REQUIRED';
}

function buildStatement({ classification, visualConfidence, longitudinalConfidence, regressionFear }) {
  if (classification === 'HIGH_CONFIDENCE_SAFE') {
    return 'Evidence supports a high-confidence, bounded improvement, but execution still requires normal governance and rollback checks.';
  }
  if (classification === 'MEDIUM_CONFIDENCE_SANDBOX') {
    return 'Evidence suggests a medium-confidence improvement, but confidence is limited because visual and longitudinal evidence are not yet complete.';
  }
  if (classification === 'LOW_CONFIDENCE_REVIEW_REQUIRED') {
    return 'Evidence is not strong enough for direct execution; review is required before touching product behavior.';
  }
  const visualLevel = visualConfidence.level || 'LOW';
  const longLevel = longitudinalConfidence.level || 'LOW';
  const fearLevel = regressionFear.level || 'UNKNOWN';
  return `Speculative execution rejected; visual confidence is ${visualLevel}, longitudinal confidence is ${longLevel}, and regression fear is ${fearLevel}.`;
}

function buildLimits({ visualConfidence, longitudinalConfidence, evidence, risk }) {
  const limits = [];
  if ((visualConfidence.notes || []).length) limits.push(...visualConfidence.notes);
  if ((longitudinalConfidence.notes || []).length) limits.push(...longitudinalConfidence.notes);
  if (evidence < 60) limits.push('evidence strength below high-confidence threshold');
  if (risk >= 35) limits.push('change risk requires sandboxing or approval');
  return [...new Set(limits)];
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

module.exports = { estimateExecutionConfidence };
