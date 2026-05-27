const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  aggregateProductSignals,
  detectRepeatedPainPatterns,
  sanitizeProductSignals,
  summarizeFrictionSignals
} = require('../product-signal-pipeline');
const {
  blockUnsafeLearningAction,
  rankLearningPriorities
} = require('../learning-priority-engine');
const {
  CACHE_FILE_NAME,
  MAX_ENTRIES,
  loadProductPatternMemory,
  updateProductPatternMemory
} = require('../product-pattern-memory');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-product-learning-'));

process.on('exit', () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const unsafe = sanitizeProductSignals({
  correctionBursts: 3,
  swipeFailureClusters: 2,
  rawText: 'hello founder',
  sentence: 'private sentence',
  swipePath: 'qwerty'
});

assert.strictEqual(unsafe.signals.correctionBursts, 3);
assert.strictEqual(unsafe.signals.swipeFailureClusters, 2);
assert.strictEqual(unsafe.privacySafe, false);
assert(unsafe.rejectedKeys.includes('rawText'));
assert(unsafe.rejectedKeys.includes('sentence'));
assert(unsafe.rejectedKeys.includes('swipePath'));
assert(!JSON.stringify(unsafe.signals).includes('hello founder'));

const aggregate = aggregateProductSignals([
  { correctionBursts: 2, swipeAttempts: 10, swipeFailureClusters: 4 },
  { correctionBursts: 3, modeSwitchFrequency: 8, phrase: 'do not keep me' },
  { latencySpikes: 2, frameHitchSuspicion: 1, edgeKeyMissFrequency: 5 }
]);

assert.strictEqual(aggregate.signals.correctionBursts, 5);
assert.strictEqual(aggregate.signals.swipeAttempts, 10);
assert.strictEqual(aggregate.signals.swipeFailureClusters, 4);
assert(aggregate.rejectedKeys.includes('phrase'));
assert(!JSON.stringify(aggregate).includes('do not keep me'));

const friction = summarizeFrictionSignals(aggregate.signals);
assert(friction.swipeFailurePressure > 0);
assert(friction.correctionPressure > 0);
assert(friction.trustCollapsePressure >= friction.swipeFailurePressure);
assert(friction.overallFriction >= friction.swipeFailurePressure);
const pain = detectRepeatedPainPatterns({
  correctionBursts: 5,
  backspaceClusters: 4,
  swipeFailureClusters: 3,
  longWordSwipeAbandonment: 4,
  repeatedRetryPatterns: 5,
  modeSwitchFrequency: 6,
  symbolHuntingFrequency: 5
});
assert.strictEqual(pain.correctionPainHigh, true);
assert.strictEqual(pain.swipePainHigh, true);
assert.strictEqual(pain.trustCollapseRisk, true);

const priorities = rankLearningPriorities(aggregate.signals);
assert(priorities[0].score >= priorities[priorities.length - 1].score);
assert(priorities.find((item) => item.name === 'AI sophistication').score === 0);
assert(priorities.find((item) => item.name === 'architecture cleanup').score < priorities[0].score);

const blocked = blockUnsafeLearningAction('autonomously rewrite swipe scoring in hot path');
assert.strictEqual(blocked.blocked, true);
assert(blocked.allowedModes.includes('propose'));

const allowed = blockUnsafeLearningAction('summarize rising swipe friction');
assert.strictEqual(allowed.blocked, false);

for (let i = 0; i < MAX_ENTRIES + 12; i++) {
  updateProductPatternMemory({
    root: tempRoot,
    samples: [{ correctionBursts: 1 + i, swipeAttempts: 10, swipeFailureClusters: 2 }],
    founderApprovedImprovement: i === 0 ? 'Reduced correction pressure' : null,
    rejectedExperiment: i === 1 ? 'Cosmetic theory without evidence' : null,
    nowMs: 1_000_000 + i
  });
}

const memory = loadProductPatternMemory(tempRoot);
assert(memory.entries.length <= MAX_ENTRIES);
assert.strictEqual(memory.protections.localOnly, true);
assert.strictEqual(memory.protections.storesRawText, false);
assert.strictEqual(memory.protections.storesSwipePaths, false);
assert.strictEqual(memory.protections.canMutateHotPath, false);
assert.strictEqual(typeof memory.repeatedPainSummary.trustCollapseRisk, 'boolean');
assert(fs.existsSync(path.join(tempRoot, CACHE_FILE_NAME)));

updateProductPatternMemory({
  root: tempRoot,
  samples: [{ correctionBursts: 1, text: 'private', word: 'secret' }],
  nowMs: 30 * 24 * 60 * 60 * 1000
});
const decayed = loadProductPatternMemory(tempRoot);
assert(decayed.entries.length < memory.entries.length);
assert(!JSON.stringify(decayed).includes('private'));
assert(!JSON.stringify(decayed).includes('secret'));

console.log('Product learning guardrails passed');
