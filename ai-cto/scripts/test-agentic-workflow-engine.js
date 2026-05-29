const assert = require('assert');

const {
  ACTION_IDS,
  detectIntentCategory,
  enhancePredictionPipeline,
  generateAgenticWorkflow,
  generateIntelligentOutput
} = require('../product-lab/agentic-workflow-engine');

const whatsapp = generateAgenticWorkflow({
  text: 'bro can you send the apk link when build finish',
  enabled: true,
  surface: 'keyboard_overlay'
});

assert.strictEqual(whatsapp.enabled, true);
assert.strictEqual(whatsapp.intent.category, 'whatsapp_reply');
assert.strictEqual(whatsapp.privacy.networkRequired, false);
assert.strictEqual(whatsapp.privacy.rawExternalLoggingAllowed, false);
assert(whatsapp.output.refinedDraft.includes('APK link'));
assert(whatsapp.actions.some((action) => action.id === ACTION_IDS.COPY));
assert(whatsapp.actions.some((action) => action.id === ACTION_IDS.EDIT));
assert(whatsapp.actions.some((action) => action.id === ACTION_IDS.CONVERT_WHATSAPP));
assert(whatsapp.suggestions.some((suggestion) => /shorter|tone|friendly|formal/i.test(suggestion.label)));
assert.strictEqual(whatsapp.overlay.nonBlocking, true);
assert.strictEqual(whatsapp.overlay.blocksTyping, false);

const email = generateAgenticWorkflow({
  text: 'email team about meeting tomorrow 10am',
  enabled: true,
  style: 'formal'
});

assert.strictEqual(email.intent.category, 'email_draft');
assert(email.output.refinedDraft.startsWith('Subject:'));
assert(email.actions.some((action) => action.id === ACTION_IDS.CONVERT_EMAIL));
assert(email.actions.some((action) => action.id === ACTION_IDS.SAVE_TEMPLATE));

const search = detectIntentCategory('search best android keyboard offline prediction');
assert.strictEqual(search.category, 'search_query');
assert(search.confidence >= 0.7);

const plan = generateIntelligentOutput({
  text: 'plan finish keyboard swipe test build push',
  intent: { category: 'task_planning' }
});
assert(plan.refinedDraft.includes('1.'));
assert(plan.refinedDraft.includes('2.'));

const disabled = generateAgenticWorkflow({
  text: 'hello',
  enabled: false
});
assert.strictEqual(disabled.enabled, false);
assert.deepStrictEqual(disabled.actions, []);

const predictionEnhancement = enhancePredictionPipeline({
  currentText: 'make it shorter and friendly',
  predictionCandidates: ['make', 'it', 'shorter'],
  enabled: true
});
assert.strictEqual(predictionEnhancement.nonBlocking, true);
assert.strictEqual(predictionEnhancement.predictionCandidates.length, 3);
assert(predictionEnhancement.agenticOverlay.actions.length > 0);

console.log('Agentic workflow engine checks passed');
