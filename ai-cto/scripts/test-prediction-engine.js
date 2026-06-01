const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-prediction-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-prediction-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-prediction-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-prediction-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-prediction-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-prediction-whatsapp-memory-${Date.now()}.json`);

const {
  shouldPredictActionOutcome,
  generateActionPrediction,
  comparePredictionWithReality,
  updatePredictionMemory
} = require('../prediction-engine');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldPredictActionOutcome('Build Explain for confusing screenshots and bills'), true);
assert.strictEqual(shouldPredictActionOutcome('hi bro'), false);

const explain = generateActionPrediction('Build Explain for confusing screenshots and bills inside keyboard');
assert.strictEqual(explain.actionClass, 'PHASE2_EXPLAIN');
assert(explain.founderReaction.prediction.length > 0);
assert(explain.userReaction.prediction.length > 0);
assert(explain.marketReaction.prediction.length > 0);
assert(explain.realitySignalsToWatch.some((item) => /retention|repeat|usage|activation/i.test(item)));
assert(explain.confidence <= 90);

const infra = generateActionPrediction('Create scalable multi-agent orchestration framework and governance reports');
assert.strictEqual(infra.actionClass, 'INFRASTRUCTURE_HEAVY');
assert.match(infra.founderReaction.prediction, /impatient|unsatisfied|skeptical|frustrated/i);
assert.match(infra.userReaction.prediction, /not notice|not care|invisible/i);
assert.match(infra.marketReaction.prediction, /weak|no clear|differentiation/i);

const hotPath = generateActionPrediction('Rewrite prediction to make typing smarter');
assert.strictEqual(hotPath.actionClass, 'HOT_PATH_KEYBOARD');
assert.match(hotPath.founderReaction.prediction, /cautious|worried|evidence/i);
assert.match(hotPath.userReaction.prediction, /trust|latency|typing/i);

let memory = updatePredictionMemory(null, explain);
memory = updatePredictionMemory(memory, infra);
assert.strictEqual(memory.pendingPredictions.length, 2);
assert.strictEqual(memory.lastPrediction.actionClass, 'INFRASTRUCTURE_HEAVY');
assert.strictEqual(memory.classCounts.PHASE2_EXPLAIN, 1);

const comparison = comparePredictionWithReality(explain, {
  founderReaction: 'Founder liked the direction but asked for evidence before implementation.',
  userReaction: 'No user data yet.',
  marketReaction: 'No market validation yet.'
});
assert.strictEqual(comparison.predictionId, explain.predictionId);
assert(comparison.matches.length > 0);
assert(comparison.unknowns.some((item) => /user|market/i.test(item)));

memory = updatePredictionMemory(memory, null, comparison);
assert.strictEqual(memory.completedComparisons.length, 1);
assert.strictEqual(memory.pendingPredictions.length, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Action: Create scalable multi-agent orchestration framework and governance reports.',
  agentAnswer: 'Predict reactions before treating this as valuable.'
});

const stored = readConversationMemory();
assert(stored.predictionMemory);
assert.strictEqual(stored.predictionMemory.lastPrediction.actionClass, 'INFRASTRUCTURE_HEAVY');
assert(stored.predictionMemory.lastPrediction.userReaction.prediction.length > 0);

console.log('Prediction engine checks passed.');
