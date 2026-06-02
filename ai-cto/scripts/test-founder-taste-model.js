const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-taste-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-taste-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-taste-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-taste-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-taste-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-taste-whatsapp-memory-${Date.now()}.json`);

const { routeMessage } = require('../whatsapp/command-router');
const {
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const {
  analyzeAnswerTaste,
  updateFounderTasteModel,
  applyFounderTasteToResponse
} = require('../founder-taste-model');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder taste model test');

const forbidden = /(TASK_PLAN|APPROVE|Execution Plan|Health:\s*\d+|Momentum|Team is ready|complexity report)/i;

const strategicAnswer = [
  'You are chasing a trusted phone-native intelligence layer.',
  'The useful test is whether users get leverage from Explain without losing keyboard trust.',
  'The risk is that this becomes impressive infrastructure unless real user behavior proves repeat use.',
  'So the next answer should stay honest about the unproven assumption and connect the work to product value.'
].join('\n');
const strategicTaste = analyzeAnswerTaste(strategicAnswer);
assert.strictEqual(strategicTaste.tone, 'direct_conversational');
assert.notStrictEqual(strategicTaste.strategicDensity, 'low');
assert.notStrictEqual(strategicTaste.skepticismLevel, 'low');

const firstQuestion = "Bro what do you think I'm actually chasing?";
const firstAnswer = routeMessage(firstQuestion, {}, {});
assert.strictEqual(firstAnswer.command, 'founder_mind_reconstruction');
assert.match(firstAnswer.response, /personal intelligence layer|leverage|trust/i);

updateMemory(firstAnswer.command, {}, {
  ...(firstAnswer.details || {}),
  founderMessage: firstQuestion,
  agentAnswer: strategicAnswer
});

const goodFeedback = routeMessage('good answer', {}, readConversationMemory());
assert.strictEqual(goodFeedback.command, 'founder_feedback_recorded');
assert.match(goodFeedback.response, /Taste profile:/);
assert.doesNotMatch(goodFeedback.response, forbidden);

let memory = readConversationMemory();
assert(memory.founderTasteModel);
assert(memory.founderTasteModel.likedPatterns.length >= 1);
assert(memory.founderTasteModel.repeatedLikes.includes('leverage'));
assert(memory.founderTasteModel.repeatedLikes.includes('user_value'));
assert(memory.founderTasteModel.repeatedLikes.includes('brutal_truth'));
assert.strictEqual(memory.founderTasteModel.profile.preferredTone, 'direct_conversational');

const rejectedModel = updateFounderTasteModel(memory.founderTasteModel, {
  timestamp: new Date().toISOString(),
  feedback: 'too_generic',
  polarity: 'negative',
  confidence: 86,
  questionPattern: 'what progress did we make today',
  answerPattern: 'health momentum status',
  rawAnswerPreview: 'Health 30. Momentum stalled. Team ready.'
});
assert(rejectedModel.rejectedPatterns.length >= 1);
assert.strictEqual(rejectedModel.rejectedPatterns[0].tone, 'status');
assert(rejectedModel.repeatedRejects.includes('status_reports'));
assert(rejectedModel.repeatedRejects.includes('momentum_reports'));

let model = rejectedModel;
for (let i = 0; i < 3; i += 1) {
  model = updateFounderTasteModel(model, {
    timestamp: new Date().toISOString(),
    feedback: 'good_answer',
    polarity: 'positive',
    confidence: 88,
    questionPattern: 'what are we chasing',
    answerPattern: 'trusted phone intelligence leverage trust risk evidence user product explain premortem blindspot disagree brutal truth',
    rawAnswerPreview: `${strategicAnswer}\nIf I had to disagree, I would say the biggest blindspot is lack of user proof. Premortem: we fail if this stays impressive instead of useful.`
  });
}

const calibrated = applyFounderTasteToResponse('Health 30. Momentum stalled.', {
  memory: { founderTasteModel: model }
});
assert.match(calibrated, /Founder taste calibration:/);
assert.match(calibrated, /direct|user leverage|hard risk|reasoning/i);
assert.doesNotMatch(calibrated, /Health 30|Momentum stalled/i);
assert(model.repeatedLikes.includes('strategic_disagreement'));
assert(model.repeatedLikes.includes('premortem'));
assert(model.repeatedLikes.includes('blindspot_discovery'));
assert(model.repeatedRejects.includes('generic_cto_language'));

console.log('Founder taste model checks passed.');
