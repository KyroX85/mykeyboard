const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { updateVisualProductMemory, loadVisualProductMemory } = require('../product-lab/visual-product-memory-engine');
const { detectRecurringFriction } = require('../product-lab/recurring-friction-engine');
const { updateLongitudinalUxMemory, loadLongitudinalUxMemory } = require('../product-lab/longitudinal-ux-memory');
const { buildCalmRecommendation } = require('../product-lab/calm-recommendation-engine');
const { runProductAwarenessLoop } = require('../product-lab/product-awareness-loop');
const { buildScreenshotTimeline } = require('../product-lab/screenshot-timeline-engine');
const { trackTrustErosion } = require('../product-lab/trust-erosion-tracker');
const { reduceFounderInterruptions } = require('../product-lab/founder-interruption-reducer');
const { computeProductStabilityTrend } = require('../product-lab/product-stability-trend-engine');
const { runContinuousProductSteward } = require('../product-lab/continuous-product-steward-engine');
const { updateProductInstinctMemoryV2, loadProductInstinctMemoryV2 } = require('../product-lab/product-instinct-memory-v2');

const evidenceA = {
  id: 'cycle-1',
  capturedAt: '2026-05-28T06:00:00.000Z',
  candidate: {
    width: 720,
    height: 360,
    averageKeyWidth: 39,
    averageKeyGap: 3,
    darkModeContrastRatio: 4.0,
    symbolToggleTravelPx: 180,
    edgeKeyWidth: 37,
    overlapCount: 0
  },
  baseline: {
    width: 720,
    height: 370,
    averageKeyWidth: 44,
    averageKeyGap: 6,
    darkModeContrastRatio: 4.8,
    symbolToggleTravelPx: 120,
    edgeKeyWidth: 44,
    overlapCount: 0
  },
  quality: {
    screenshotCount: 1,
    hasBaseline: true,
    resolutionMatched: true,
    annotated: false,
    deviceWidthKnown: true
  }
};

const evidenceB = {
  ...evidenceA,
  id: 'cycle-2',
  capturedAt: '2026-05-28T14:00:00.000Z'
};

const evidenceC = {
  ...evidenceA,
  id: 'cycle-3',
  capturedAt: '2026-05-28T22:00:00.000Z'
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-stewardship-'));

const tasteMemory = updateProductInstinctMemoryV2({
  root: tempRoot,
  founderPreference: 'prefer calm symbol ergonomics over clever layout churn',
  rejectedPattern: 'multi-agent keyboard rewrite',
  survivedFix: 'small edge spacing adjustment',
  fatigueIncrease: 'dense compact layout',
  rhythmImprovement: 'stable number strip across modes'
});
assert(tasteMemory.founderPreferences.includes('prefer calm symbol ergonomics over clever layout churn'));
assert(loadProductInstinctMemoryV2(tempRoot).rejectedPatterns.includes('multi-agent keyboard rewrite'));

const memory = updateVisualProductMemory({
  root: tempRoot,
  screenshotEvidence: evidenceA,
  cycleId: evidenceA.id
});
updateVisualProductMemory({ root: tempRoot, screenshotEvidence: evidenceB, cycleId: evidenceB.id });
updateVisualProductMemory({ root: tempRoot, screenshotEvidence: evidenceC, cycleId: evidenceC.id });
const loadedVisualMemory = loadVisualProductMemory(tempRoot);
assert.strictEqual(loadedVisualMemory.cycles.length, 3);
assert(loadedVisualMemory.recurringIssues.some((issue) => issue.count >= 3));

const recurring = detectRecurringFriction(loadedVisualMemory);
assert.strictEqual(recurring.highest.issue, 'cramped-spacing');
assert.strictEqual(recurring.highest.count, 3);
assert(recurring.summary.includes('3 screenshot cycles'));

const uxMemory = updateLongitudinalUxMemory({
  root: tempRoot,
  observation: 'compact-layout symbol crowding',
  confidence: 'MEDIUM',
  outcome: 'observed recurring visual discomfort'
});
assert(loadLongitudinalUxMemory(tempRoot).observations.length >= 1);
assert.strictEqual(uxMemory.observations[0].observation, 'compact-layout symbol crowding');

const timeline = buildScreenshotTimeline(loadedVisualMemory);
assert.strictEqual(timeline.cyclesObserved, 3);
assert(timeline.densityDrift.score > 0);
assert(timeline.edgeKeyConfidenceTrend !== 'UNKNOWN');

const trust = trackTrustErosion({
  recurringFriction: recurring,
  productSignals: {
    correctionBurden: 3,
    visualDiscomfort: 6,
    trustErosion: 5
  }
});
assert(trust.score > 0);
assert(trust.drivers.includes('recurring visual friction'));

const stability = computeProductStabilityTrend({
  timeline,
  regressionHistory: [
    { type: 'symbol-friction', status: 'open' },
    { type: 'cramped-spacing', status: 'open' }
  ],
  activeExperiments: 0
});
assert(['STABLE_WITH_RECURRING_FRICTION', 'UNSTABLE'].includes(stability.trend));

const recommendation = buildCalmRecommendation({
  recurringFriction: recurring,
  trustErosion: trust,
  stabilityTrend: stability,
  confidence: 'MEDIUM',
  proposedAction: 'increase compact-width edge-key spacing by 2-3dp only',
  regressionRisk: 'LOW'
});
assert.strictEqual(recommendation.action, 'ASK_APPROVAL_FOR_BOUNDED_EXPERIMENT');
assert(recommendation.message.includes('No other action recommended today.'));
assert(!recommendation.message.includes('rewrite'));

const interruption = reduceFounderInterruptions({
  recommendations: [recommendation],
  maxDailyRecommendations: 1
});
assert.strictEqual(interruption.messages.length, 1);
assert.strictEqual(interruption.suppressedCount, 0);

const awareness = runProductAwarenessLoop({
  root: tempRoot,
  screenshotEvidence: evidenceC,
  productSignals: {
    recurringFriction: 8,
    visualDiscomfort: 6,
    trustErosion: 5
  },
  regressionHistory: [{ type: 'cramped-spacing', status: 'open' }],
  activeExperiments: 0
});
assert.strictEqual(awareness.phase, 'PHASE_1_6_CONTINUOUS_PRODUCT_STEWARDSHIP');
assert(awareness.observation.includes('highest recurring pressure'));

const stewardship = runContinuousProductSteward({
  root: tempRoot,
  screenshotEvidence: evidenceC,
  productSignals: {
    recurringFriction: 8,
    visualDiscomfort: 6,
    trustErosion: 5
  },
  regressionHistory: [{ type: 'cramped-spacing', status: 'open' }],
  activeExperiments: 0
});
assert.strictEqual(stewardship.phase, 'PHASE_1_6_CONTINUOUS_PRODUCT_STEWARDSHIP');
assert.strictEqual(stewardship.mode, 'AUTONOMOUS_AWARENESS_ONLY');
assert.strictEqual(stewardship.mutationAllowed, false);
assert.strictEqual(stewardship.whatsappReady.length, 1);
assert(stewardship.whatsappReady[0].includes('Founder,'));
assert(stewardship.whatsappReady[0].includes('Proceed?'));
assert(stewardship.whatsappReady[0].includes('No other action recommended today.'));

const quietRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-quiet-stewardship-'));
const quiet = runContinuousProductSteward({
  root: quietRoot,
  productSignals: {
    recurringFriction: 0,
    visualDiscomfort: 0,
    trustErosion: 0
  },
  regressionHistory: [],
  activeExperiments: 0
});
assert.strictEqual(quiet.whatsappReady[0], 'Founder, no action recommended today. Current stabilization trend is healthy.');
assert.strictEqual(quiet.mutationAllowed, false);

console.log('Continuous product stewardship checks passed');
