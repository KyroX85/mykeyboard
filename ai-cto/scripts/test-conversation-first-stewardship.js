const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { executionActivationDecision } = require('../product-lab/execution-activation-engine');
const { decideIntentDominance } = require('../product-lab/intent-dominance-engine');
const { routeConversationFirst } = require('../product-lab/conversation-first-router');
const { answerNaturalProductDiscussion } = require('../product-lab/natural-product-discussion-engine');
const { shouldGenerateReport } = require('../product-lab/report-optional-engine');
const { answerLightweightConversation } = require('../product-lab/lightweight-conversation-engine');
const { rememberFounderDiscussion, loadFounderDiscussionMemory } = require('../product-lab/founder-discussion-memory');
const { prioritizeProductConversation } = require('../product-lab/product-conversation-priority-engine');
const { preventOverexecution } = require('../product-lab/anti-overexecution-engine');
const { estimateConversationalLatency } = require('../product-lab/conversational-latency-engine');

const productContext = {
  immatureAgainstGboard: 'visual calmness, spacing rhythm, and compact-layout swipe confidence',
  highestTrustPressure: 'swipe hesitation near edge regions and visual density tension',
  recurringFriction: 'symbol crowding has appeared across compact-width screenshots',
  saferToday: 'stability is more valuable than another predictor experiment'
};

for (const message of [
  'What currently feels immature compared to Gboard?',
  'compare this to gboard',
  'analyze what hurts typing trust most',
  'summarize today’s product risks honestly',
  'explain what recurring friction exists',
  'review whether no change is safer',
  'what would users dislike?',
  'what worries you most?'
]) {
  const activation = executionActivationDecision(message);
  assert.strictEqual(activation.executionRequested, false, message);
  const dominance = decideIntentDominance(message);
  assert.notStrictEqual(dominance.intent, 'EXECUTION', message);
  const route = routeConversationFirst({ message, productContext });
  assert.notStrictEqual(route.mode, 'EXECUTION', message);
  assert.strictEqual(route.mutationAllowed, false, message);
  assert.strictEqual(route.reportGenerationAllowed, false, message);
  assert(!route.response.includes('Low-risk task accepted'), message);
  assert(!route.response.includes('Starting execution'), message);
  assert(!route.response.includes('AMBIGUOUS INTENT DETECTED'), message);
}

const explicitExecution = routeConversationFirst({
  message: 'IMPLEMENT a small patch and COMMIT it',
  productContext,
  governanceMode: 'ACTIVE'
});
assert.strictEqual(explicitExecution.mode, 'EXECUTION');
assert.strictEqual(explicitExecution.reportGenerationAllowed, false);
assert(explicitExecution.response.includes('Execution intent is explicit'));

const reportRequest = routeConversationFirst({
  message: 'generate report about symbol friction',
  productContext,
  governanceMode: 'ACTIVE'
});
assert.strictEqual(reportRequest.mode, 'EXECUTION');
assert.strictEqual(reportRequest.reportGenerationAllowed, true);

const preservationExecution = routeConversationFirst({
  message: 'FIX KeyboardService.kt and commit it',
  productContext,
  governanceMode: 'PRESERVATION_ONLY'
});
assert.strictEqual(preservationExecution.mode, 'EXECUTION');
assert.strictEqual(preservationExecution.mutationAllowed, false);
assert(preservationExecution.response.includes('PRESERVATION_ONLY'));

const gboard = answerNaturalProductDiscussion({
  message: 'What currently feels immature compared to Gboard?',
  productContext
});
assert(gboard.includes('Visual calmness and spacing rhythm'));
assert(gboard.includes('Swipe confidence'));
assert(!gboard.includes('report'));

assert.strictEqual(shouldGenerateReport('summarize today’s product risks honestly').allowed, false);
assert.strictEqual(shouldGenerateReport('generate report about today’s product risks').allowed, true);

const light = answerLightweightConversation({
  message: 'Should we change anything today?',
  productContext
});
assert(light.length < 280);
assert(light.includes('stability'));
assert(!light.includes('governance'));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-founder-discussion-'));
const memory = rememberFounderDiscussion({
  root: tempRoot,
  message: 'what feels unpolished?',
  topic: 'Gboard maturity comparison',
  productConcern: 'visual calmness'
});
assert.strictEqual(memory.currentTopic, 'Gboard maturity comparison');
assert.strictEqual(loadFounderDiscussionMemory(tempRoot).activeProductConcern, 'visual calmness');

const priority = prioritizeProductConversation('what would increase retention most?');
assert.strictEqual(priority.primary, 'retention');
assert(priority.conversationFirst);

const blockedOverexecution = preventOverexecution({
  message: 'analyze compact layout friction',
  proposedMode: 'EXECUTION'
});
assert.strictEqual(blockedOverexecution.mode, 'THINKING');
assert.strictEqual(blockedOverexecution.prevented, true);

const latency = estimateConversationalLatency({
  response: 'Probably swipe hesitation near edge regions and visual density tension.',
  warnings: 0,
  reportSections: 0
});
assert.strictEqual(latency.level, 'LIGHT');

console.log('Conversation-first stewardship checks passed');
