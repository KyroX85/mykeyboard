const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-world-model-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-world-model-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-world-model-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-world-model-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-world-model-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-world-model-whatsapp-memory-${Date.now()}.json`);

const {
  updateVisionMemory
} = require('../vision-memory-engine');
const {
  updateFounderWorldModel,
  retrieveFounderWorldModel,
  formatFounderWorldModelForResponse
} = require('../founder-world-model-engine');
const { buildDreamAlignment, formatDreamAlignment } = require('../dream-model');
const { routeMessage } = require('../whatsapp/command-router');
const { updateMemory, readConversationMemory } = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');
const { answerFounderBrainQuestion } = require('../founder-brain-api');

setMode('ACTIVE', 'founder world model engine test');

let visionMemory = updateVisionMemory(null, {
  founderMessage: 'Old vision: destroy loneliness through an AI companion.'
});
visionMemory = updateVisionMemory(visionMemory, {
  founderMessage: 'Old vision again: destroy loneliness with a trusted AI companion.'
});

let worldModel = updateFounderWorldModel(null, {
  founderMessage: 'Old vision: destroy loneliness through an AI companion.',
  visionMemory
});
assert.match(worldModel.currentWorldModel.currentWorldview, /loneliness/i);
assert.match(worldModel.currentWorldModel.currentMission, /companion/i);

visionMemory = updateVisionMemory(visionMemory, {
  founderMessage: 'New vision: reduce burden humans carry alone. Humans choose direction, AI executes. Trust over capability. Freedom over dependency.'
});
worldModel = updateFounderWorldModel(worldModel, {
  founderMessage: 'New vision: reduce burden humans carry alone. Humans choose direction, AI executes. Trust over capability. Freedom over dependency.',
  visionMemory
});
assert(worldModel.candidateWorldModelChange);
assert.match(worldModel.currentWorldModel.currentWorldview, /loneliness/i);

visionMemory = updateVisionMemory(visionMemory, {
  founderMessage: 'Current founder worldview: reduce burden humans carry alone. Humans choose direction; AI executes. Trust over capability. Freedom over dependency.'
});
worldModel = updateFounderWorldModel(worldModel, {
  founderMessage: 'Current founder worldview: reduce burden humans carry alone. Humans choose direction; AI executes. Trust over capability. Freedom over dependency.',
  visionMemory
});

const active = retrieveFounderWorldModel(worldModel);
assert.match(active.currentWorldview, /Humans should keep agency/i);
assert.match(active.currentMission, /trusted phone-native intelligence layer/i);
assert(active.currentFears.some((fear) => /dependency/i.test(fear)));
assert(active.currentMotivations.some((motivation) => /trust over raw capability|freedom over dependency/i.test(motivation)));
assert.match(active.currentDefinitionOfSuccess, /preserving their agency/i);
assert.match(active.currentDefinitionOfFailure, /impressive but optional|removes agency/i);
assert.match(active.previousWorldview, /loneliness/i);
assert.match(active.worldviewShift, /loneliness.*Humans should keep agency/i);
assert(active.worldviewConfidence >= 75);

const formatted = formatFounderWorldModelForResponse(worldModel);
assert.match(formatted, /Current Founder Worldview:/);
assert.match(formatted, /Current Founder Mission:/);
assert.match(formatted, /Current Definition of Success:/);
assert.match(formatted, /Worldview Confidence:/);

const alignment = buildDreamAlignment({
  question: 'Bro what contradiction do you see in Jarvis doing everything?',
  visionMemory,
  founderWorldModel: worldModel
});
assert.match(alignment.founderDream, /trusted phone-native intelligence layer/i);
assert.match(formatDreamAlignment(alignment), /Current Founder Worldview:/);
assert.doesNotMatch(formatDreamAlignment(alignment), /Founder dream: Destroy loneliness/i);

const route = routeMessage('Bro are we moving toward the dream?', {}, {
  visionMemory,
  founderWorldModel: worldModel
});
assert.strictEqual(route.command, 'founder_mind_reconstruction');
assert.match(route.response, /Current Founder Worldview:/);
assert.match(route.response, /Humans should keep agency/i);
assert.match(route.response, /Current Founder Mission:/);
assert.doesNotMatch(route.response, /Founder dream: Destroy loneliness/i);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Current founder worldview: reduce burden humans carry alone. Humans choose direction. AI executes. Trust over capability. Freedom over dependency.',
  agentAnswer: 'World model noted.',
  intent: 'world_model_update'
});
updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Again: humans choose direction, AI executes. Freedom over dependency. Trust over capability.',
  agentAnswer: 'World model reinforced.',
  intent: 'world_model_update'
});
const stored = readConversationMemory();
assert(stored.founderWorldModel);
assert.match(stored.founderWorldModel.currentWorldModel.currentWorldview, /Humans should keep agency/i);

(async () => {
  const brain = await answerFounderBrainQuestion({
    question: 'Bro what contradiction do you see in Jarvis doing everything?',
    memory: {
      visionMemory,
      founderWorldModel: worldModel
    },
    routeImpl: async (question, state, memory, options) => routeMessage(question, state, memory, options)
  });
  assert.match(brain.rawReasoning, /Current Founder Worldview:/);
  assert(brain.sources.includes('founder_world_model'));
  console.log('Founder world model engine checks passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
