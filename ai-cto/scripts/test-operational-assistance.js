const assert = require('assert');

const {
  PRODUCT_SIGNALS,
  classifyOperationalImpact,
  detectFakeProductivity,
  validatePatchProposal,
  enforceMaintenanceLimits,
  summarizeOperationalAssistance
} = require('./operational-assistance');

const state = {
  healthScore: 58,
  momentum: 'WATCH',
  validation: [
    { task: ':app:testDebugUnitTest', status: 'passed' },
    { task: ':app:lintDebug', status: 'failed' }
  ],
  sections: {
    risks: ['[HIGH] swipe reliability regression still unresolved'],
    unresolved: ['[CRITICAL] crash likelihood unknown on fast typing'],
    completedFixes: ['Generated report cleanup summary'],
    repeatedFailures: ['lintDebug failed twice'],
    nextPriority: ['Validate swipe trail reliability on device']
  },
  changed: {
    completed: ['Generated report cleanup summary'],
    newRisks: ['[HIGH] swipe reliability regression still unresolved']
  }
};

assert(PRODUCT_SIGNALS.includes('typing latency'));
assert(PRODUCT_SIGNALS.includes('swipe reliability'));
assert(!PRODUCT_SIGNALS.includes('report count'));

const lowImpact = classifyOperationalImpact({
  title: 'Documentation cleanup pass',
  expectedImpact: 'Cleaner report wording',
  signals: ['report generation']
});
assert.strictEqual(lowImpact.level, 'LOW OPERATIONAL IMPACT');

const productImpact = classifyOperationalImpact({
  title: 'Reduce swipe trail allocations',
  expectedImpact: 'Lower hot-path allocations during swipe rendering',
  signals: ['swipe reliability', 'hot-path allocations']
});
assert.strictEqual(productImpact.level, 'PRODUCT IMPACT');

const fakePatterns = detectFakeProductivity(state, [
  { action: 'report-compression', result: 'DRY_RUN' },
  { action: 'documentation-cleanup', result: 'DRY_RUN' },
  { action: 'architecture-summary', result: 'DRY_RUN' }
]);
assert(fakePatterns.some((item) => item.includes('report')));
assert(fakePatterns.some((item) => item.includes('LOW OPERATIONAL IMPACT')));

const safeProposal = validatePatchProposal({
  title: 'Tune swipe trail buffer',
  exactFiles: ['app/src/main/res/values/integers.xml'],
  exactConstants: ['swipe_trail_buffer_limit'],
  expectedImprovement: 'Improve swipe reliability during long gestures',
  runtimeImpact: 'Lower trail clipping risk',
  regressionRisk: 'LOW',
  rollbackComplexity: 'LOW',
  riskLevel: 'LOW'
});
assert.strictEqual(safeProposal.ok, true);

const dangerousProposal = validatePatchProposal({
  title: 'Rewrite prediction model',
  exactFiles: ['app/src/main/java/com/example/Predictor.kt'],
  exactConstants: ['model_path'],
  expectedImprovement: 'New prediction behavior',
  runtimeImpact: 'Prediction changes',
  regressionRisk: 'HIGH',
  rollbackComplexity: 'HIGH',
  riskLevel: 'HIGH'
});
assert.strictEqual(dangerousProposal.ok, false);
assert(dangerousProposal.reason.includes('approval'));

const malformedProposal = validatePatchProposal({
  title: 'Maybe fix thing',
  exactFiles: [],
  expectedImprovement: '',
  runtimeImpact: '',
  regressionRisk: 'LOW',
  rollbackComplexity: 'LOW',
  riskLevel: 'LOW'
});
assert.strictEqual(malformedProposal.ok, false);

const limited = enforceMaintenanceLimits([
  { action: 'a', riskLevel: 'LOW' },
  { action: 'b', riskLevel: 'LOW' },
  { action: 'c', riskLevel: 'LOW' },
  { action: 'd', riskLevel: 'LOW' },
  { action: 'danger', riskLevel: 'HIGH' }
]);
assert.strictEqual(limited.allowed.length, 3);
assert.strictEqual(limited.blocked.length, 2);
assert(limited.blocked.some((entry) => entry.reason.includes('HIGH-risk')));

const summary = summarizeOperationalAssistance(state, fakePatterns);
assert(summary.includes('Build: 1 failing validation'));
assert(summary.includes('Swipe: risk recorded'));
assert(summary.includes('Founder load:'));
assert(summary.length < 600);

console.log('Operational assistance checks passed.');
