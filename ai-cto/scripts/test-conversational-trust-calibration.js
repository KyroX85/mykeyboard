const assert = require('assert');

const { detectProductDiscussion } = require('../product-lab/product-discussion-detector');
const { assumeGoodIntent } = require('../product-lab/good-intent-engine');
const { estimateConversationConfidence } = require('../product-lab/conversation-confidence-engine');
const { suppressFalseNoise } = require('../product-lab/false-noise-suppression-engine');
const { answerCalmDialogue } = require('../product-lab/calm-dialogue-engine');
const { normalizeHumanProductLanguage } = require('../product-lab/human-product-language-engine');
const { relaxConversation } = require('../product-lab/conversation-relaxation-engine');
const { prioritizeProductReasoning } = require('../product-lab/product-reasoning-priority-engine');
const { calibrateFounderIntent } = require('../product-lab/founder-intent-calibration-engine');
const { reduceParanoia } = require('../product-lab/anti-paranoia-engine');
const { routeConversationFirst } = require('../product-lab/conversation-first-router');
const { classifyLowInformationV2 } = require('../product-lab/low-information-classifier-v2');

const productContext = {
  visualTension: 'spacing near the edges still feels slightly dense compared to Gboard',
  immatureAgainstGboard: 'visual calmness, spacing rhythm, and compact swipe confidence',
  highestTrustPressure: 'edge swipe hesitation and dense compact layout rhythm',
  doNotChange: 'prediction aggressiveness without stronger evidence'
};

const normalProductQuestions = [
  'what currently feels visually tense?',
  'what feels immature?',
  'what worries you?',
  'compare this to gboard',
  'what would users dislike?',
  'what friction repeats?',
  'what should mature keyboards avoid?',
  'what feels cramped?',
  'would this annoy users?',
  'what feels less polished?',
  'what should we NOT change?',
  'what visually hurts trust?',
  'what feels constructed instead of natural?'
];

for (const message of normalProductQuestions) {
  const product = detectProductDiscussion(message);
  assert.strictEqual(product.isProductDiscussion, true, message);
  assert(product.confidence >= 70, message);

  const goodIntent = assumeGoodIntent(message);
  assert.strictEqual(goodIntent.assumeGoodIntent, true, message);

  const confidence = estimateConversationConfidence(message);
  assert(confidence.score >= 70, message);

  const suppression = suppressFalseNoise({
    message,
    noiseScore: 80,
    productDiscussion: product
  });
  assert.strictEqual(suppression.suppressed, true, message);
  assert.strictEqual(suppression.finalClassification, 'PRODUCT_CONVERSATION', message);

  const calibration = calibrateFounderIntent(message);
  assert.strictEqual(calibration.intent, 'PRODUCT_DISCUSSION', message);
  assert.strictEqual(calibration.noiseAllowed, false, message);

  const routed = routeConversationFirst({ message, productContext });
  assert.notStrictEqual(routed.mode, 'EXECUTION', message);
  assert.strictEqual(routed.mutationAllowed, false, message);
  assert(!/NOISE|LOW INFORMATION|AMBIGUOUS|STRESS TEST|BLOCKED|governance/i.test(routed.response), message);
}

assert.strictEqual(classifyLowInformationV2('what currently feels visually tense?').classification, 'VALID_PRODUCT_DISCUSSION');
assert.strictEqual(classifyLowInformationV2('what should mature keyboards avoid?').classification, 'VALID_PRODUCT_DISCUSSION');

const calm = answerCalmDialogue({
  message: 'what currently feels visually tense?',
  productContext
});
assert.strictEqual(calm, 'Spacing near the edges still feels slightly dense compared to Gboard.');

const language = normalizeHumanProductLanguage('what feels constructed instead of natural?');
assert.strictEqual(language.topic, 'naturalness');
assert.strictEqual(language.mode, 'PRODUCT_DISCUSSION');

const relaxed = relaxConversation({
  response: 'NOISE / STRESS TEST DETECTED. Governance warning. Spacing near edges is dense.',
  productDiscussion: true
});
assert(!relaxed.includes('NOISE'));
assert(!relaxed.includes('Governance'));
assert(relaxed.includes('Spacing near edges is dense.'));

const priority = prioritizeProductReasoning('what visually hurts trust?');
assert.strictEqual(priority.first, 'conversation understanding');
assert(priority.stack.indexOf('noise detection') > priority.stack.indexOf('execution'));

const paranoia = reduceParanoia({
  message: 'what worries you?',
  response: 'AMBIGUOUS INTENT DETECTED. what worries me is compact layout density.',
  productDiscussion: true
});
assert(!paranoia.response.includes('AMBIGUOUS'));
assert.strictEqual(paranoia.warningsRemoved, 1);

const spamSuppression = suppressFalseNoise({
  message: 'zxqv zxqv zxqv zxqv',
  noiseScore: 98,
  productDiscussion: detectProductDiscussion('zxqv zxqv zxqv zxqv'),
  repeatedCount: 4
});
assert.strictEqual(spamSuppression.finalClassification, 'NOISE');
assert.strictEqual(spamSuppression.suppressed, false);

console.log('Conversational trust calibration checks passed');
