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
  findRelevantFounderFeedback,
  buildFounderFeedbackGuidance,
  applyFounderFeedbackToResponse
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
const neutralFeedback = classifyFounderFeedback('mixed answer');
assert.strictEqual(neutralFeedback.feedback, 'neutral_reaction');
assert.strictEqual(neutralFeedback.polarity, 'neutral');
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
assert.strictEqual(memoryAfterFeedback.founderFeedback[0].routeUsed.key, 'founder_mind_reconstruction');
assert.match(memoryAfterFeedback.founderFeedback[0].failureReason, /wrong_depth|wrong_abstraction_level|negative feedback/i);
assert(memoryAfterFeedback.questionPatternRouteScores[memoryAfterFeedback.founderFeedback[0].questionPattern]);
assert(memoryAfterFeedback.questionPatternRouteScores[memoryAfterFeedback.founderFeedback[0].questionPattern].routes.founder_mind_reconstruction.negative >= 1);

const relevant = findRelevantFounderFeedback('What am I actually chasing?', memoryAfterFeedback);
assert(relevant.length >= 1);
assert.strictEqual(relevant[0].feedback, 'too_generic');

const repeatedStyleMemory = {
  founderFeedback: [
    {
      timestamp: new Date().toISOString(),
      feedback: 'too_much_cto_mode',
      polarity: 'negative',
      confidence: 86,
      adaptation: 'stay_conversational',
      sourceMessage: 'too much cto mode',
      founderReaction: {
        label: 'too_much_cto_mode',
        polarity: 'negative',
        confidence: 86,
        sourceMessage: 'too much cto mode'
      },
      questionPattern: 'bro are we moving toward the dream',
      answerPattern: 'health momentum task plan'
    },
    {
      timestamp: new Date().toISOString(),
      feedback: 'too_much_cto_mode',
      polarity: 'negative',
      confidence: 86,
      adaptation: 'stay_conversational',
      sourceMessage: 'too much report',
      founderReaction: {
        label: 'too_much_cto_mode',
        polarity: 'negative',
        confidence: 86,
        sourceMessage: 'too much report'
      },
      questionPattern: 'are we moving toward the dream',
      answerPattern: 'current foundation health protected recommended next step'
    },
    {
      timestamp: new Date().toISOString(),
      feedback: 'too_generic',
      polarity: 'negative',
      confidence: 86,
      adaptation: 'add_specific_product_test',
      sourceMessage: 'too generic',
      founderReaction: {
        label: 'too_generic',
        polarity: 'negative',
        confidence: 86,
        sourceMessage: 'too generic'
      },
      questionPattern: 'what am i missing',
      answerPattern: 'current foundation health protected recommended next step'
    },
    {
      timestamp: new Date().toISOString(),
      feedback: 'good_answer',
      polarity: 'positive',
      confidence: 88,
      adaptation: 'preserve_direct_reasoning',
      sourceMessage: 'good answer',
      founderReaction: {
        label: 'good_answer',
        polarity: 'positive',
        confidence: 88,
        sourceMessage: 'good answer'
      },
      questionPattern: 'what would you disagree with',
      answerPattern: 'direct strategic disagreement'
    },
    {
      timestamp: new Date().toISOString(),
      feedback: 'neutral_reaction',
      polarity: 'neutral',
      confidence: 70,
      adaptation: 'watch_for_followup',
      sourceMessage: 'mixed answer',
      founderReaction: {
        label: 'neutral_reaction',
        polarity: 'neutral',
        confidence: 70,
        sourceMessage: 'mixed answer'
      },
      questionPattern: 'what is happening',
      answerPattern: 'partial answer'
    }
  ]
};
const guidance = buildFounderFeedbackGuidance('What am I missing?', repeatedStyleMemory);
assert(guidance.feedbackUsed.length >= 1);
assert(guidance.rejectedStyles.includes('cto/report framing'));
assert(guidance.rejectedStyles.includes('generic answer'));
assert(guidance.preferredAdaptations.includes('stay_conversational'));
assert(guidance.sourceCounts.negative >= 2);
assert(guidance.sourceCounts.neutral >= 1);
assert(guidance.confidence <= 90);

const templated = [
  'Current Foundation Health: protected.',
  'Trust Risk: do not trade keyboard trust for features.',
  'Recommended Next Step: continue.'
].join('\n');
const adaptedTemplate = applyFounderFeedbackToResponse(templated, {
  message: 'What am I missing?',
  memory: repeatedStyleMemory
});
assert.doesNotMatch(adaptedTemplate, /Current Foundation Health|Recommended Next Step|Trust Risk/i);
assert.match(adaptedTemplate, /Concrete test|conversational/i);

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
const memoryAfterPositive = readConversationMemory();
const positiveFeedback = memoryAfterPositive.founderFeedback.find((entry) => entry.feedback === 'good_answer');
assert(positiveFeedback);
assert.strictEqual(positiveFeedback.polarity, 'positive');
assert.strictEqual(positiveFeedback.routeUsed.key, 'founder_mind_reconstruction');
assert.match(positiveFeedback.successReason, /founder approved/i);
assert(memoryAfterPositive.questionPatternRouteScores[positiveFeedback.questionPattern]);
assert(memoryAfterPositive.questionPatternRouteScores[positiveFeedback.questionPattern].routes.founder_mind_reconstruction.positive >= 1);

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
