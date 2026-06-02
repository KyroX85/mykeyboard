const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-principle-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-principle-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-principle-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-principle-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-principle-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-principle-whatsapp-memory-${Date.now()}.json`);

const {
  extractPrinciplesFromFeedback,
  updatePrincipleMemory,
  applyFounderPrinciplesToResponse,
  formatPrinciplesForResponse
} = require('../principle-extraction-engine');
const {
  recordFounderFeedback
} = require('../whatsapp/founder-feedback-learning-layer');
const {
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'principle extraction engine test');

const repeatedFeedback = [
  {
    feedback: 'too_generic',
    polarity: 'negative',
    answerPattern: 'Generic answer with Current Foundation Health and Recommended Next Step',
    adaptation: 'add_specific_product_test'
  },
  {
    feedback: 'too_much_cto_mode',
    polarity: 'negative',
    answerPattern: 'Health 30. Momentum stalled. Team ready.',
    adaptation: 'stay_conversational'
  },
  {
    feedback: 'not_relevant',
    polarity: 'negative',
    answerPattern: 'TASK_PLAN Execution Plan Files Validation',
    adaptation: 'answer_actual_question_first'
  }
];

const principles = extractPrinciplesFromFeedback(repeatedFeedback);
assert(principles.some((item) => /strategic truth over operational reporting/i.test(item.principle)));
assert(principles.some((item) => /answer the founder objective before formatting/i.test(item.principle)));
assert(principles.every((item) => item.evidence.length >= 1));

let memory = updatePrincipleMemory(null, repeatedFeedback);
assert.strictEqual(memory.version, '1.0');
assert(memory.principles.length >= 2);
assert(memory.principles[0].confidence <= 90);

const formatted = formatPrinciplesForResponse(memory);
assert.match(formatted, /Founder principles:/);
assert.match(formatted, /strategic truth/i);

const cleaned = applyFounderPrinciplesToResponse(
  'Current Foundation Health: protected.\nHealth: 30\nMomentum: STALLED\nYou are probably testing whether this creates user leverage.',
  { memory: { founderPrinciples: memory } }
);
assert.doesNotMatch(cleaned, /Current Foundation Health|Health:\s*\d+|Momentum:/i);
assert.match(cleaned, /user leverage/i);
assert.match(cleaned, /Founder principle applied:/i);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'What progress did we make today?',
  agentAnswer: 'Current Foundation Health: protected. Health: 30. Momentum stalled.',
  intent: 'progress_reality'
});
recordFounderFeedback('too generic', readConversationMemory(), {
  feedback: 'too_generic',
  polarity: 'negative',
  confidence: 86,
  adaptation: 'add_specific_product_test',
  sourceMessage: 'too generic'
});
recordFounderFeedback('too much CTO mode', readConversationMemory(), {
  feedback: 'too_much_cto_mode',
  polarity: 'negative',
  confidence: 86,
  adaptation: 'stay_conversational',
  sourceMessage: 'too much CTO mode'
});
recordFounderFeedback('not relevant', readConversationMemory(), {
  feedback: 'not_relevant',
  polarity: 'negative',
  confidence: 90,
  adaptation: 'answer_actual_question_first',
  sourceMessage: 'not relevant'
});

const stored = readConversationMemory();
assert(stored.founderPrinciples);
assert(stored.founderPrinciples.principles.some((item) => /strategic truth over operational reporting/i.test(item.principle)));

console.log('Principle extraction engine checks passed.');
