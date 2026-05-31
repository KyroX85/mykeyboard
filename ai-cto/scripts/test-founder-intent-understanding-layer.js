const assert = require('assert');
const {
  understandFounderObjective,
  routeFounderIntentUnderstanding
} = require('../whatsapp/founder-intent-understanding-layer');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');

const visionUnderstanding = understandFounderObjective('Do the agents really understand my vision?');
assert.strictEqual(visionUnderstanding.intent, 'ASSESS_AGENT_VISION_UNDERSTANDING');
assert(visionUnderstanding.objective.includes('deployed agents'));
assert(visionUnderstanding.selfCheck.includes('answered'));

const routedVision = routeMessage('Do the agents really understand my vision?', {}, {});
assert.strictEqual(routedVision.matchedRoute, 'founder_intent_understanding');
assert(routedVision.response.includes('Partially'));
assert(routedVision.response.includes('Founder objective I inferred:'));
assert(routedVision.response.includes('Self-check: answered'));
assert(!routedVision.response.includes('Current Foundation Health'));
assert(!routedVision.response.includes('Recommended Next Step'));

const templateFailure = routeMessage('Why did the agent give a keyword-triggered template response?', {}, {});
assert.strictEqual(templateFailure.matchedRoute, 'founder_intent_understanding');
assert(templateFailure.response.includes('keyword routing'));
assert(templateFailure.response.includes('founder objective'));

const explainPain = routeMessage('What user pain does Explain solve?', {}, {});
assert.strictEqual(explainPain.matchedRoute, 'founder_intent_understanding');
assert(explainPain.response.includes('confusing'));
assert(!explainPain.response.includes('Current Foundation Health'));

const privacy = routeMessage('Can Explain store screenshots forever?', {}, {});
assert.strictEqual(privacy.matchedRoute, 'founder_intent_understanding');
assert(privacy.response.includes('No, Explain should not store screenshots forever.'));

const execution = routeFounderIntentUnderstanding('implement the intent understanding layer now');
assert.strictEqual(execution, null);

(async () => {
  const withAi = await routeMessageWithAi('Do the agents really understand my vision?', {}, {});
  assert.strictEqual(withAi.matchedRoute, 'founder_intent_understanding');
  assert.strictEqual(withAi.usedAi, false);
  assert(withAi.response.includes('Partially'));
  assert(!withAi.response.includes('Current Foundation Health'));
  console.log('Founder intent understanding layer checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
