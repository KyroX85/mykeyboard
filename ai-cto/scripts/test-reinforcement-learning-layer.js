const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-rl-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-rl-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-rl-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-rl-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-rl-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-rl-whatsapp-memory-${Date.now()}.json`);

const { routeMessage } = require('../whatsapp/command-router');
const {
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const {
  rankRoutesWithReinforcement,
  rewardFromMessage,
  shouldPreferReinforcedConversation
} = require('../whatsapp/reinforcement-learning-layer');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'reinforcement learning layer test');

function persist(route, founderMessage) {
  updateMemory(route.command, {}, {
    ...(route.details || {}),
    founderMessage,
    agentAnswer: route.response,
    matchedRoute: route.matchedRoute
  });
}

const firstQuestion = "Bro what do you think I'm actually chasing?";
const first = routeMessage(firstQuestion, {}, readConversationMemory());
assert.strictEqual(first.command, 'founder_mind_reconstruction');
persist(first, firstQuestion);

const positive = routeMessage('correct', {}, readConversationMemory());
assert.strictEqual(positive.command, 'founder_feedback_recorded');
persist(positive, 'correct');

let memory = readConversationMemory();
assert(memory.routeScores.founder_mind_reconstruction);
assert(memory.routeScores.founder_mind_reconstruction.score > 0);
assert.strictEqual(memory.routeScores.founder_mind_reconstruction.positive, 1);
assert(memory.reinforcementEvents.length >= 1);
assert.strictEqual(memory.reinforcementEvents[0].routeKey, 'founder_mind_reconstruction');

const ranked = rankRoutesWithReinforcement(memory, [
  'agent',
  'founder_mind_reconstruction',
  'conversational_fallback'
]);
assert.strictEqual(ranked[0].key, 'founder_mind_reconstruction');
assert(shouldPreferReinforcedConversation('Bro something feels off', memory));

const reinforced = routeMessage('Bro something feels off', {}, memory);
assert.strictEqual(reinforced.command, 'founder_mind_reconstruction');
assert.strictEqual(reinforced.details.reinforcementPreferred, true);
assert(reinforced.details.routeReinforcement);
assert(reinforced.details.routeReinforcement.score > 0);
persist(reinforced, 'Bro something feels off');

const negative = routeMessage('too generic', {}, readConversationMemory());
assert.strictEqual(negative.command, 'founder_feedback_recorded');
persist(negative, 'too generic');

memory = readConversationMemory();
assert(memory.routeScores.founder_mind_reconstruction.negative >= 1);
assert(memory.routeScores.founder_mind_reconstruction.score < 2.25);

const scoreBeforeFix = memory.routeScores.founder_mind_reconstruction.score;
const fixReward = rewardFromMessage('fix');
assert.strictEqual(fixReward.value, -2);
updateMemory('execution_fix', {}, {
  founderMessage: 'fix',
  agentAnswer: 'No safe execution happened.'
});

memory = readConversationMemory();
assert(memory.routeScores.founder_mind_reconstruction.score < scoreBeforeFix);
assert(memory.lastReward.rewardLabel === 'founder_fix_request');

console.log('Reinforcement learning layer checks passed.');
