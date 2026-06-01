const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-wrong-answer-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-wrong-answer-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-wrong-answer-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-wrong-answer-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-wrong-answer-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-wrong-answer-whatsapp-memory-${Date.now()}.json`);

const { routeMessage } = require('../whatsapp/command-router');
const {
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const {
  analyzeWrongAnswer,
  updateWrongAnswerMemory
} = require('../wrong-answer-analyzer');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'wrong answer analyzer test');

const statusFailure = analyzeWrongAnswer({
  feedback: 'too_much_cto_mode',
  polarity: 'negative',
  rawQuestionPreview: 'Bro are we even moving toward the dream?',
  rawAnswerPreview: 'CTO: Founder, team is online. Health: 30/100. Momentum stalled. TASK_PLAN ready.',
  questionPattern: 'bro are we even moving toward the dream',
  answerPattern: 'team ready health momentum task plan'
});
assert(statusFailure.failureReasons.includes('wrong_route'));
assert(statusFailure.failureReasons.includes('wrong_tone'));
assert(statusFailure.failureReasons.includes('wrong_assumption'));
assert.strictEqual(statusFailure.primaryFailureReason, 'wrong_route');

const shallowFailure = analyzeWrongAnswer({
  feedback: 'too_generic',
  polarity: 'negative',
  rawQuestionPreview: 'What are we actually chasing?',
  rawAnswerPreview: 'We are building a keyboard.',
  questionPattern: 'what are we actually chasing',
  answerPattern: 'we are building a keyboard'
});
assert(shallowFailure.failureReasons.includes('wrong_depth'));
assert(shallowFailure.failureReasons.includes('wrong_abstraction_level'));

let memory = updateWrongAnswerMemory(null, statusFailure);
memory = updateWrongAnswerMemory(memory, shallowFailure);
assert.strictEqual(memory.totalFailures, 2);
assert(memory.failureCounts.wrong_route >= 1);
assert(memory.failureCounts.wrong_depth >= 1);
assert.strictEqual(memory.recentFailures[0].primaryFailureReason, 'wrong_depth');

const question = 'Bro are we even moving toward the dream?';
const answer = routeMessage(question, {}, {});
updateMemory(answer.command, {}, {
  ...(answer.details || {}),
  founderMessage: question,
  agentAnswer: 'CTO: Founder, team is online. Health: 30/100. Momentum stalled.'
});

const feedback = routeMessage('too much CTO mode', {}, readConversationMemory());
assert.strictEqual(feedback.command, 'founder_feedback_recorded');
assert.match(feedback.response, /Failure analyzed:/);
assert.match(feedback.response, /wrong route|wrong tone|wrong assumption/i);
assert.doesNotMatch(feedback.response, /TASK_PLAN|APPROVE|Execution Plan/i);

const stored = readConversationMemory();
assert(stored.founderFeedback[0].wrongAnswerAnalysis);
assert(stored.wrongAnswerAnalysis);
assert(stored.wrongAnswerAnalysis.failureCounts.wrong_route >= 1);

console.log('Wrong answer analyzer checks passed.');
