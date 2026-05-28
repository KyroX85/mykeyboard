const { classifyVisualFriction } = require('./visual-friction-engine');
const { estimateVisualConfidence } = require('./visual-confidence-engine');
const { rankProductFeelPriorities } = require('./product-feel-priority-engine');
const { estimateTrustDecay } = require('./trust-decay-estimator');
const { estimateRegressionFear } = require('./regression-fear-engine');
const { enforceCalmProductExecution } = require('./calm-product-engine');
const { estimateLongitudinalConfidence } = require('./longitudinal-confidence-engine');
const { evaluateFounderTasteAlignment } = require('./founder-taste-alignment-engine');
const { estimateExecutionConfidence } = require('./execution-confidence-engine');

const PHASE = 'PHASE_1_5_TRUSTWORTHY_PRODUCT_EXECUTION';

function evaluateTrustworthyExecution({
  request = '',
  screenshotEvidence = {},
  productSignals = {},
  proposal = '',
  patchSurface = {},
  longitudinal = {},
  founderApproved = false
} = {}) {
  const visual = classifyVisualFriction(screenshotEvidence);
  const visualConfidence = estimateVisualConfidence(screenshotEvidence);
  const priorities = rankProductFeelPriorities(productSignals);
  const highestPain = priorities[0] || { name: 'unknown', score: 0 };
  const trustDecay = estimateTrustDecay({
    correctionBursts: productSignals.correctionBurden || 0,
    repeatedFrictionDays: productSignals.recurringFriction || 0,
    visualDiscomfort: productSignals.visualDiscomfort || 0,
    regressions: productSignals.regressionPrevention || 0,
    latencySpikes: productSignals.responsiveness || 0
  });
  const regressionFear = estimateRegressionFear({
    protectedFiles: visual.likelySubsystems || [],
    filesTouched: patchSurface.files || 0,
    linesChanged: patchSurface.lines || 0,
    rollbackComplexity: patchSurface.rollbackComplexity || 'LOW',
    hotPathRuntime: Boolean(patchSurface.hotPathRuntime)
  });
  const longitudinalConfidence = estimateLongitudinalConfidence(longitudinal);
  const evidenceStrength = evidenceStrengthFor({ visual, visualConfidence, productSignals });
  const executionConfidence = estimateExecutionConfidence({
    evidenceStrength,
    visualConfidence,
    longitudinalConfidence,
    regressionFear,
    changeRisk: regressionFear.score,
    patchSurface
  });
  const calm = enforceCalmProductExecution({
    proposedChange: proposal,
    filesTouched: patchSurface.files || 0,
    linesChanged: patchSurface.lines || 0,
    rewritePressure: /rewrite|modernize|architecture|framework/i.test(proposal),
    productBenefit: benefitFor(highestPain, visual),
    evidenceBacked: evidenceStrength >= 35
  });
  const taste = evaluateFounderTasteAlignment({
    proposal,
    evidenceSummary: visual.visualSummary.join(' '),
    visibleBehaviorChange: benefitFor(highestPain, visual),
    addsPersonality: /personality|companion|emotional/i.test(proposal),
    addsArchitecture: /architecture|framework|multi-agent|scalable rewrite/i.test(proposal)
  });
  const canExecuteNow = Boolean(
    founderApproved &&
    calm.allowed &&
    taste.aligned &&
    executionConfidence.classification !== 'SPECULATIVE_DO_NOT_EXECUTE' &&
    executionConfidence.classification !== 'LOW_CONFIDENCE_REVIEW_REQUIRED'
  );
  const report = buildReport({
    request,
    proposal,
    highestPain,
    visual,
    visualConfidence,
    executionConfidence,
    trustDecay,
    regressionFear,
    longitudinalConfidence,
    calm,
    taste,
    canExecuteNow
  });

  return {
    phase: PHASE,
    canExecuteNow,
    highestPain,
    visual,
    visualConfidence,
    executionConfidence,
    trustDecay,
    regressionFear,
    longitudinalConfidence,
    calm,
    taste,
    report
  };
}

function evidenceStrengthFor({ visual, visualConfidence, productSignals }) {
  const findingStrength = Math.min(30, (visual.findings || []).length * 12);
  const signalStrength = Math.min(25, Number(productSignals.recurringFriction || 0) * 2 + Number(productSignals.trustErosion || 0));
  return Math.min(100, 25 + findingStrength + signalStrength + Math.round((visualConfidence.score || 0) * 0.15));
}

function benefitFor(highestPain, visual) {
  if ((visual.findings || []).some((finding) => finding.type === 'edge-key-risk')) {
    return 'thumb confidence and edge-key trust';
  }
  if ((visual.findings || []).some((finding) => finding.type === 'symbol-friction')) {
    return 'symbol comfort and typing rhythm';
  }
  return `${highestPain.name || 'Phase 1 trust'} stability`;
}

function buildReport({
  request,
  proposal,
  highestPain,
  visual,
  visualConfidence,
  executionConfidence,
  trustDecay,
  regressionFear,
  longitudinalConfidence,
  calm,
  taste,
  canExecuteNow
}) {
  const visualNotes = [...(visualConfidence.notes || []), ...(executionConfidence.limits || [])];
  const findings = visual.visualSummary.length ? visual.visualSummary.join('; ') : 'No measurable visual issue crossed threshold.';
  return [
    `PHASE: ${PHASE}`,
    `REQUEST: ${request}`,
    '',
    'WHY THIS IS THE HIGHEST PHASE 1 PAIN',
    `${highestPain.name} is ranked first because current evidence gives it a score of ${highestPain.score}; architecture and sophistication are intentionally deprioritized.`,
    '',
    'EXECUTION CONFIDENCE',
    `${executionConfidence.classification} (${executionConfidence.score}/100). ${executionConfidence.statement}`,
    '',
    'VISUAL CONFIDENCE',
    `${visualConfidence.level} (${visualConfidence.score}/100). ${visualNotes.length ? visualNotes.join('; ') : 'visual evidence adequate for bounded review'}.`,
    '',
    'TRUST IMPACT',
    `${visual.trustImpact}. Observed evidence: ${findings}`,
    '',
    'RETENTION IMPACT',
    `Trust decay risk is ${trustDecay.level} (${trustDecay.score}/100), driven by ${trustDecay.drivers.join(', ') || 'no strong decay driver'}.`,
    '',
    'REGRESSION FEAR',
    `${regressionFear.level} (${regressionFear.score}/100), reasons: ${regressionFear.reasons.join(', ') || 'small bounded surface'}.`,
    '',
    'WHY THIS IS SAFER THAN ALTERNATIVES',
    `${proposal || visual.safestFix} touches the minimum product variable instead of rewriting sizing, prediction, or swipe systems.`,
    '',
    'WHAT REMAINS SPECULATIVE',
    `${longitudinalConfidence.notes.join('; ') || 'longitudinal confidence is present'}; root cause remains limited until before/after screenshots and repeated validation exist.`,
    '',
    'WHY THIS CHANGE IS MINIMAL',
    `${calm.minimumNecessaryChange}. Founder taste alignment: ${taste.aligned ? 'aligned' : `blocked (${taste.violations.join(', ')})`}.`,
    '',
    `EXECUTION STATE: ${canExecuteNow ? 'APPROVED_TO_PREPARE_BOUNDED_PATCH' : 'WAIT_FOR_FOUNDER_APPROVAL'}`
  ].join('\n');
}

module.exports = {
  PHASE,
  evaluateTrustworthyExecution
};
