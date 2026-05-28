const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { estimateExecutionConfidence } = require('../product-lab/execution-confidence-engine');
const { estimateVisualConfidence } = require('../product-lab/visual-confidence-engine');
const { rankProductFeelPriorities } = require('../product-lab/product-feel-priority-engine');
const { estimateTrustDecay } = require('../product-lab/trust-decay-estimator');
const { estimateRegressionFear } = require('../product-lab/regression-fear-engine');
const { enforceCalmProductExecution } = require('../product-lab/calm-product-engine');
const { updateProductInstinctMemory, loadProductInstinctMemory } = require('../product-lab/product-instinct-memory');
const { estimateLongitudinalConfidence } = require('../product-lab/longitudinal-confidence-engine');
const { evaluateFounderTasteAlignment } = require('../product-lab/founder-taste-alignment-engine');
const { evaluateTrustworthyExecution } = require('../product-lab/trustworthy-product-execution');

const weakScreenshot = {
  source: 'single screenshot',
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

const visualConfidence = estimateVisualConfidence(weakScreenshot);
assert.strictEqual(visualConfidence.level, 'MEDIUM');
assert(visualConfidence.notes.some((note) => /visual evidence weak/i.test(note)));
assert(visualConfidence.ambiguity > 0);

const priorities = rankProductFeelPriorities({
  recurringFriction: 8,
  trustErosion: 7,
  typingInterruption: 3,
  correctionBurden: 2,
  visualDiscomfort: 6,
  thumbConfidence: 7,
  swipeHesitation: 4,
  installUpdateStability: 1,
  fatigue: 5,
  regressionPrevention: 6,
  architectureCleanup: 10,
  sophistication: 10
});
assert.strictEqual(priorities[0].name, 'recurring friction');
assert(priorities.find((item) => item.name === 'architecture cleanup').score < priorities[0].score);
assert(priorities.find((item) => item.name === 'sophistication').score < priorities[0].score);

const confidence = estimateExecutionConfidence({
  evidenceStrength: 58,
  visualConfidence,
  longitudinalConfidence: { score: 25, level: 'LOW' },
  regressionFear: { score: 45 },
  changeRisk: 35,
  patchSurface: { files: 1, lines: 12 }
});
assert.strictEqual(confidence.classification, 'MEDIUM_CONFIDENCE_SANDBOX');
assert(confidence.statement.includes('confidence is limited'));
assert(!confidence.statement.includes('definitely fixes'));

const speculative = estimateExecutionConfidence({
  evidenceStrength: 15,
  visualConfidence: { score: 20, level: 'LOW' },
  longitudinalConfidence: { score: 0, level: 'LOW' },
  regressionFear: { score: 75 },
  changeRisk: 80,
  patchSurface: { files: 5, lines: 200 }
});
assert.strictEqual(speculative.classification, 'SPECULATIVE_DO_NOT_EXECUTE');

const trustDecay = estimateTrustDecay({
  correctionBursts: 5,
  repeatedFrictionDays: 4,
  visualDiscomfort: 6,
  regressions: 1
});
assert(trustDecay.score > 0);
assert(trustDecay.drivers.includes('recurring friction'));

const fear = estimateRegressionFear({
  protectedFiles: ['KeyboardSizingProfile.kt'],
  filesTouched: 1,
  linesChanged: 12,
  rollbackComplexity: 'LOW',
  hotPathRuntime: false
});
assert.strictEqual(fear.level, 'LOW-MEDIUM');

const calm = enforceCalmProductExecution({
  proposedChange: '+3dp edge padding for small width bucket',
  filesTouched: 1,
  linesChanged: 12,
  rewritePressure: false,
  productBenefit: 'thumb confidence',
  evidenceBacked: true
});
assert.strictEqual(calm.allowed, true);
assert(calm.minimumNecessaryChange.includes('1 file'));

const churn = enforceCalmProductExecution({
  proposedChange: 'rewrite keyboard sizing architecture',
  filesTouched: 7,
  linesChanged: 250,
  rewritePressure: true,
  productBenefit: 'internal cleanup',
  evidenceBacked: false
});
assert.strictEqual(churn.allowed, false);
assert(churn.rejections.includes('rewrite pressure'));

const longConfidence = estimateLongitudinalConfidence({
  evidenceDays: 1,
  repeatedFindings: 1,
  successfulValidations: 0,
  rollbackFreeDays: 0
});
assert.strictEqual(longConfidence.level, 'LOW');
assert(longConfidence.notes.includes('no longitudinal evidence exists yet'));

const taste = evaluateFounderTasteAlignment({
  proposal: 'small reversible spacing adjustment to reduce symbol fatigue',
  evidenceSummary: 'screenshot shows cramped symbol travel',
  visibleBehaviorChange: 'calmer thumb reach',
  addsPersonality: false,
  addsArchitecture: false
});
assert.strictEqual(taste.aligned, true);
assert(taste.values.includes('calm'));

const badTaste = evaluateFounderTasteAlignment({
  proposal: 'modern scalable multi-agent rewrite with animated smart keyboard personality',
  evidenceSummary: '',
  visibleBehaviorChange: '',
  addsPersonality: true,
  addsArchitecture: true
});
assert.strictEqual(badTaste.aligned, false);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-instinct-memory-'));
const memory = updateProductInstinctMemory({
  root: tempRoot,
  event: 'small spacing adjustments reduce symbol fatigue',
  outcome: 'improved_calm',
  avoid: 'large sizing rewrites without longitudinal evidence'
});
assert.strictEqual(memory.principles.includes('small spacing adjustments reduce symbol fatigue'), true);
const loaded = loadProductInstinctMemory(tempRoot);
assert(loaded.avoidPatterns.includes('large sizing rewrites without longitudinal evidence'));

const execution = evaluateTrustworthyExecution({
  request: 'adaptive keyboard sizing feels cramped on smaller phones',
  screenshotEvidence: weakScreenshot,
  productSignals: {
    recurringFriction: 8,
    trustErosion: 7,
    visualDiscomfort: 6,
    thumbConfidence: 7,
    regressionPrevention: 6,
    architectureCleanup: 10
  },
  proposal: '+3dp edge padding for small width bucket',
  patchSurface: { files: 1, lines: 12 },
  longitudinal: { evidenceDays: 1, repeatedFindings: 1, successfulValidations: 0 },
  founderApproved: false
});
assert.strictEqual(execution.phase, 'PHASE_1_5_TRUSTWORTHY_PRODUCT_EXECUTION');
assert.strictEqual(execution.executionConfidence.classification, 'MEDIUM_CONFIDENCE_SANDBOX');
assert.strictEqual(execution.canExecuteNow, false);
assert(execution.report.includes('WHY THIS IS THE HIGHEST PHASE 1 PAIN'));
assert(execution.report.includes('EXECUTION CONFIDENCE'));
assert(execution.report.includes('VISUAL CONFIDENCE'));
assert(execution.report.includes('REGRESSION FEAR'));
assert(execution.report.includes('WHAT REMAINS SPECULATIVE'));
assert(execution.report.includes('WHY THIS CHANGE IS MINIMAL'));
assert(execution.report.includes('visual evidence weak'));
assert(!execution.report.includes('definitely fixes'));

console.log('Trustworthy product execution checks passed');
