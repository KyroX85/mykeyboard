const assert = require('assert');

const {
  selectAdaptiveFollowUp,
  updateAdaptiveCuriosityMemory,
  applyAdaptiveCuriosityToPrompt
} = require('../adaptive-curiosity-layer');
const {
  buildCuriosityPrompt,
  formatCuriosityPrompt
} = require('../curiosity-layer');

const emptySelection = selectAdaptiveFollowUp({
  domain: 'dissatisfaction',
  fallbackQuestion: 'Is the issue capability, design, trust, or emotional reaction?'
});
assert.strictEqual(emptySelection.question, 'Is the issue capability, design, trust, or emotional reaction?');
assert.strictEqual(emptySelection.source, 'fallback');

let memory = updateAdaptiveCuriosityMemory(null, {
  domain: 'dissatisfaction',
  question: 'Is the issue capability, design, trust, or emotional reaction?',
  outcome: 'negative',
  founderReply: 'too generic'
});
memory = updateAdaptiveCuriosityMemory(memory, {
  domain: 'dissatisfaction',
  question: 'Is this feature failing because users would not return to it, or because it feels untrustworthy?',
  outcome: 'positive',
  founderReply: 'correct'
});
memory = updateAdaptiveCuriosityMemory(memory, {
  domain: 'dissatisfaction',
  question: 'Is this feature failing because users would not return to it, or because it feels untrustworthy?',
  outcome: 'positive',
  founderReply: 'good answer'
});

const learned = selectAdaptiveFollowUp({
  domain: 'dissatisfaction',
  fallbackQuestion: 'Is the issue capability, design, trust, or emotional reaction?',
  memory
});
assert.match(learned.question, /users would not return|untrustworthy/i);
assert.strictEqual(learned.source, 'learned');
assert(learned.score > 0);

const prompt = buildCuriosityPrompt({
  message: "I don't like this feature.",
  confidence: 82
});
const adapted = applyAdaptiveCuriosityToPrompt(prompt, { memory });
assert.match(formatCuriosityPrompt(adapted), /users would not return|untrustworthy/i);
assert.strictEqual(adapted.adaptive.source, 'learned');

console.log('Adaptive curiosity layer checks passed.');
