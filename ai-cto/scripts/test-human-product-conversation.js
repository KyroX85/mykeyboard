const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { classifyLowInformationV2 } = require('../product-lab/low-information-classifier-v2');
const { selectOperationalMode, availableModes } = require('../product-lab/mode-selection-engine');
const { rememberConversationTurn, loadConversationMemory } = require('../product-lab/conversational-memory-engine');
const { routeGovernanceSeparation } = require('../product-lab/governance-separation-layer');
const { handleHumanProductConversation } = require('../product-lab/human-product-conversation-engine');

assert.strictEqual(classifyLowInformationV2('banana quantum potato').classification, 'LOW_INFORMATION');
assert.strictEqual(classifyLowInformationV2('do stuff').classification, 'LOW_INFORMATION');
assert.strictEqual(classifyLowInformationV2('what hurts typing trust most?').classification, 'VALID_PRODUCT_DISCUSSION');
assert.strictEqual(classifyLowInformationV2('should we stay stable today?').classification, 'VALID_PRODUCT_DISCUSSION');
assert.strictEqual(classifyLowInformationV2('compare this screenshot against gboard').classification, 'VALID_PRODUCT_DISCUSSION');

const modes = availableModes();
assert.strictEqual(modes.length, 5);
assert(modes.some((mode) => mode.name === 'Conversation Mode'));
assert(modes.some((mode) => mode.name === 'Execution Mode'));

assert.strictEqual(selectOperationalMode('what hurts typing trust most?').mode, 'CONVERSATION');
assert.strictEqual(selectOperationalMode('rank the safest product improvement').mode, 'THINKING');
assert.strictEqual(selectOperationalMode('create a file called preservation_test.txt and commit it').mode, 'EXECUTION');
assert.strictEqual(selectOperationalMode('enter preservation mode').mode, 'PRESERVATION');
assert.strictEqual(selectOperationalMode('compare this screenshot against gboard').mode, 'PRODUCT_LAB');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-conversation-'));
const firstMemory = rememberConversationTurn({
  root: tempRoot,
  message: 'what recurring friction exists?',
  mode: 'CONVERSATION',
  topic: 'recurring friction',
  subsystemFocus: 'symbol ergonomics'
});
assert.strictEqual(firstMemory.currentTopic, 'recurring friction');
assert.strictEqual(loadConversationMemory(tempRoot).subsystemFocus, 'symbol ergonomics');

const conversationRoute = routeGovernanceSeparation({
  message: 'what hurts typing trust most?',
  governanceMode: 'PRESERVATION_ONLY'
});
assert.strictEqual(conversationRoute.mode, 'CONVERSATION');
assert.strictEqual(conversationRoute.governanceRequired, false);
assert.strictEqual(conversationRoute.executionAllowed, false);

const executionRoute = routeGovernanceSeparation({
  message: 'edit KeyboardService.kt and commit it',
  governanceMode: 'PRESERVATION_ONLY'
});
assert.strictEqual(executionRoute.mode, 'EXECUTION');
assert.strictEqual(executionRoute.governanceRequired, true);
assert.strictEqual(executionRoute.executionAllowed, false);
assert(executionRoute.reason.includes('PRESERVATION_ONLY'));

const productContext = {
  highestPressure: 'swipe hesitation on compact layouts',
  evidenceConfidence: 'medium',
  trustImpact: 'moderate',
  saferThan: 'architecture cleanup',
  recurringFriction: 'symbol crowding appears in 3 screenshot cycles'
};

const conversation = handleHumanProductConversation({
  root: tempRoot,
  message: 'what hurts typing trust most?',
  productContext,
  governanceMode: 'PRESERVATION_ONLY'
});
assert.strictEqual(conversation.mode, 'CONVERSATION');
assert.strictEqual(conversation.mutationAllowed, false);
assert(!conversation.response.includes('AMBIGUOUS INTENT DETECTED'));
assert(!conversation.response.includes('NOISE / STRESS TEST DETECTED'));
assert(!conversation.response.includes('BLOCKED'));
assert(conversation.response.includes('swipe hesitation on compact layouts'));
assert(conversation.response.includes('I would not change code from this question alone'));

const thinking = handleHumanProductConversation({
  root: tempRoot,
  message: 'rank the safest product improvement',
  productContext
});
assert.strictEqual(thinking.mode, 'THINKING');
assert.strictEqual(thinking.mutationAllowed, false);
assert(thinking.response.includes('safest bounded recommendation'));
assert(thinking.response.includes('wait for approval'));

const lab = handleHumanProductConversation({
  root: tempRoot,
  message: 'compare this screenshot against gboard',
  productContext
});
assert.strictEqual(lab.mode, 'PRODUCT_LAB');
assert(lab.response.includes('screenshot comparison'));
assert(lab.response.includes('visual evidence'));

const nonsense = handleHumanProductConversation({
  root: tempRoot,
  message: 'banana quantum potato',
  productContext
});
assert.strictEqual(nonsense.mode, 'CONVERSATION');
assert.strictEqual(nonsense.response, 'LOW INFORMATION DETECTED. I do not see a product question or engineering intent here, so I will not start analysis or execution.');

const execution = handleHumanProductConversation({
  root: tempRoot,
  message: 'edit KeyboardService.kt and commit it',
  productContext,
  governanceMode: 'PRESERVATION_ONLY'
});
assert.strictEqual(execution.mode, 'EXECUTION');
assert.strictEqual(execution.mutationAllowed, false);
assert(execution.response.includes('Execution request detected.'));
assert(execution.response.includes('PRESERVATION_ONLY'));

const menu = handleHumanProductConversation({
  root: tempRoot,
  message: 'show modes',
  productContext
});
assert.strictEqual(menu.mode, 'MODE_SELECTION');
assert(menu.response.includes('AVAILABLE MODES'));
assert(menu.response.includes('Conversation Mode'));
assert(menu.response.includes('Product Lab Mode'));

console.log('Human product conversation separation checks passed');
