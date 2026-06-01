const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-feedback-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-feedback-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-feedback-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-feedback-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-feedback-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-feedback-whatsapp-memory-${Date.now()}.json`);

const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const {
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const {
  classifyFounderFeedback,
  findRelevantFounderFeedback
} = require('../whatsapp/founder-feedback-learning-layer');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder feedback learning layer test');

const forbidden = /(TASK_PLAN|APPROVE|Execution Plan|Health:\s*\d+|Momentum|Team is ready|complexity report)/i;

const firstQuestion = "Bro what do you think I'm actually chasing?";
const firstAnswer = routeMessage(firstQuestion, {}, {});
assert.strictEqual(firstAnswer.command, 'founder_mind_reconstruction');
assert.match(firstAnswer.response, /personal intelligence layer|leverage|trust/i);

updateMemory(firstAnswer.command, {}, {
  ...(firstAnswer.details || {}),
  founderMessage: firstQuestion,
  agentAnswer: firstAnswer.response
});

assert.strictEqual(classifyFounderFeedback('too generic').feedback, 'too_generic');
const feedback = routeMessage('too generic', {}, readConversationMemory());
assert.strictEqual(feedback.command, 'founder_feedback_recorded');
assert.strictEqual(feedback.matchedRoute, 'founder_feedback_learning_layer');
assert.match(feedback.response, /Feedback recorded|add specific product test|No execution started/i);
assert.doesNotMatch(feedback.response, forbidden);

const memoryAfterFeedback = readConversationMemory();
assert(memoryAfterFeedback.founderFeedback.length >= 1);
assert.strictEqual(memoryAfterFeedback.founderFeedback[0].feedback, 'too_generic');
assert.strictEqual(memoryAfterFeedback.founderFeedback[0].polarity, 'negative');
assert.match(memoryAfterFeedback.founderFeedback[0].questionPattern, /chasing/);
assert(memoryAfterFeedback.founderFeedback[0].answerPattern);

const relevant = findRelevantFounderFeedback('What am I actually chasing?', memoryAfterFeedback);
assert(relevant.length >= 1);
assert.strictEqual(relevant[0].feedback, 'too_generic');

const secondAnswer = routeMessage('What am I actually chasing?', {}, memoryAfterFeedback);
assert.strictEqual(secondAnswer.command, 'founder_mind_reconstruction');
assert.match(secondAnswer.response, /Concrete test: name the user pain/i);
assert.doesNotMatch(secondAnswer.response, forbidden);

updateMemory(secondAnswer.command, {}, {
  ...(secondAnswer.details || {}),
  founderMessage: 'What am I actually chasing?',
  agentAnswer: secondAnswer.response
});

const positive = routeMessage('good answer', {}, readConversationMemory());
assert.strictEqual(positive.command, 'founder_feedback_recorded');
assert.match(positive.response, /preserve direct reasoning|No execution started/i);
assert.doesNotMatch(positive.response, forbidden);

routeMessageWithAi('not relevant', {}, readConversationMemory()).then((withAi) => {
  assert.strictEqual(withAi.command, 'founder_feedback_recorded');
  assert.strictEqual(withAi.usedAi, false);
  assert.strictEqual(withAi.aiReason, 'founder_mind_reconstruction');
  assert.doesNotMatch(withAi.response, forbidden);
  console.log('Founder feedback learning layer checks passed.');
}).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
