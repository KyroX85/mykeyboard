const { updateVisualProductMemory } = require('./visual-product-memory-engine');
const { detectRecurringFriction } = require('./recurring-friction-engine');
const { buildScreenshotTimeline } = require('./screenshot-timeline-engine');
const { trackTrustErosion } = require('./trust-erosion-tracker');
const { computeProductStabilityTrend } = require('./product-stability-trend-engine');
const { buildCalmRecommendation } = require('./calm-recommendation-engine');
const { updateLongitudinalUxMemory } = require('./longitudinal-ux-memory');

const PHASE = 'PHASE_1_6_CONTINUOUS_PRODUCT_STEWARDSHIP';

function runProductAwarenessLoop({
  root = process.cwd(),
  screenshotEvidence = {},
  productSignals = {},
  regressionHistory = [],
  activeExperiments = 0
} = {}) {
  const memory = screenshotEvidence && (screenshotEvidence.candidate || screenshotEvidence.baseline)
    ? updateVisualProductMemory({ root, screenshotEvidence, cycleId: screenshotEvidence.id })
    : updateVisualProductMemory({ root, screenshotEvidence: {}, cycleId: `quiet-${Date.now()}` });
  const recurringFriction = detectRecurringFriction(memory);
  const timeline = buildScreenshotTimeline(memory);
  const trustErosion = trackTrustErosion({ recurringFriction, productSignals });
  const stabilityTrend = computeProductStabilityTrend({ timeline, regressionHistory, activeExperiments });
  const confidence = confidenceFor(recurringFriction, timeline);
  const recommendation = buildCalmRecommendation({
    recurringFriction,
    trustErosion,
    stabilityTrend,
    confidence,
    proposedAction: safestActionFor(recurringFriction.highest?.issue),
    regressionRisk: stabilityTrend.trend === 'UNSTABLE' ? 'MEDIUM' : 'LOW'
  });
  if (recurringFriction.highest?.count > 0) {
    updateLongitudinalUxMemory({
      root,
      observation: recurringFriction.summary,
      confidence,
      outcome: 'observed recurring product pressure'
    });
  }
  return {
    phase: PHASE,
    memory,
    recurringFriction,
    timeline,
    trustErosion,
    stabilityTrend,
    recommendation,
    observation: recurringFriction.highest?.count > 0
      ? `highest recurring pressure: ${recurringFriction.summary}`
      : 'no recurring product pressure detected'
  };
}

function confidenceFor(recurringFriction, timeline) {
  if ((recurringFriction.highest?.count || 0) >= 3 && timeline.cyclesObserved >= 3) return 'MEDIUM-HIGH';
  if ((recurringFriction.highest?.count || 0) >= 2) return 'MEDIUM';
  return 'LOW';
}

function safestActionFor(issue) {
  if (issue === 'cramped-spacing' || issue === 'edge-key-risk') {
    return 'increase compact-width edge-key spacing by 2-3dp only';
  }
  if (issue === 'symbol-friction') {
    return 'test one symbol-access spacing adjustment only';
  }
  if (issue === 'dark-mode-contrast') {
    return 'test one contrast-token adjustment only';
  }
  return 'observe one more cycle before proposing a change';
}

module.exports = {
  PHASE,
  runProductAwarenessLoop
};
