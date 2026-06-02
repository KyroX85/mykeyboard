const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-vision-memory-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-vision-memory-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-vision-memory-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-vision-memory-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-vision-memory-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-vision-memory-whatsapp-memory-${Date.now()}.json`);

const {
  updateVisionMemory,
  retrieveActiveVision,
  formatVisionMemoryForResponse
} = require('../vision-memory-engine');
const { routeMessage } = require('../whatsapp/command-router');
const { updateMemory, readConversationMemory } = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'vision memory engine test');

let memory = updateVisionMemory(null, {
  founderMessage: 'Old vision: Aritenis should destroy loneliness with an AI companion.'
});
memory = updateVisionMemory(memory, {
  founderMessage: 'Old vision again: destroy loneliness using an AI companion.'
});
assert.match(memory.activeVision.statement, /destroy loneliness/i);
assert(memory.activeVision.confidence >= 70);
assert.strictEqual(memory.activeVision.versionLabel, 'Vision v1');
assert.match(memory.activeVision.whyItExisted, /loneliness|companion/i);

memory = updateVisionMemory(memory, {
  founderMessage: 'New vision: reduce burden humans carry alone. Humans choose direction, AI executes. Trust over capability. Freedom over dependency.'
});
assert(memory.candidateVisionChange);
assert.match(memory.candidateVisionChange.statement, /reduce burden humans carry alone/i);
assert.match(memory.activeVision.statement, /destroy loneliness/i);

memory = updateVisionMemory(memory, {
  founderMessage: 'Current vision: reduce burden humans carry alone; humans choose direction and AI executes. Trust over capability. Freedom over dependency.'
});
const active = retrieveActiveVision(memory);
assert.match(active.currentFounderVision, /reduce burden humans carry alone/i);
assert.strictEqual(active.currentVisionVersion, 'Vision v2');
assert.match(active.currentFounderVision, /humans choose direction/i);
assert.match(active.currentFounderVision, /AI executes/i);
assert.match(active.currentFounderVision, /trust over capability/i);
assert.match(active.previousVision, /destroy loneliness/i);
assert.match(active.visionShift, /destroy loneliness.*reduce burden humans carry alone/i);
assert(active.visionConfidence >= 75);
assert(Array.isArray(active.visionVersions));
assert.strictEqual(active.visionVersions[0].versionLabel, 'Vision v2');
assert.strictEqual(active.visionVersions[0].status, 'ACTIVE');
assert.match(active.visionVersions[0].whyItExisted, /agency|burden|freedom|trust/i);
assert.strictEqual(active.visionVersions[1].versionLabel, 'Vision v1');
assert.strictEqual(active.visionVersions[1].status, 'REPLACED');
assert.match(active.visionVersions[1].whyItChanged, /shifted|freedom|agency|trust|burden/i);
assert.match(active.visionVersions[1].whatReplacedIt, /Vision v2: Reduce burden/i);

const formatted = formatVisionMemoryForResponse(active);
assert.match(formatted, /Current Founder Vision: Vision v2:/);
assert.match(formatted, /Previous Vision:/);
assert.match(formatted, /Vision Shift:/);

const route = routeMessage('Bro are we moving toward the dream?', {}, {
  visionMemory: memory
});
assert.strictEqual(route.command, 'founder_mind_reconstruction');
assert.match(route.response, /reduce burden humans carry alone/i);
assert.match(route.response, /humans choose direction/i);
assert.match(route.response, /trust over capability/i);
assert.doesNotMatch(route.response, /destroy loneliness.*Founder dream/i);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Stored old vision: destroy loneliness through an AI companion.',
  agentAnswer: 'Old vision noted.',
  intent: 'vision_update'
});
updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Stored old vision again: destroy loneliness through an AI companion.',
  agentAnswer: 'Old vision reinforced.',
  intent: 'vision_update'
});
updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Current vision: reduce burden humans carry alone; humans choose direction and AI executes. Trust over capability. Freedom over dependency.',
  agentAnswer: 'Vision noted.',
  intent: 'vision_update'
});
updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Again: reduce burden humans carry alone. Humans choose direction. AI executes. Trust over capability.',
  agentAnswer: 'Vision reinforced.',
  intent: 'vision_update'
});
const stored = readConversationMemory();
assert(stored.visionMemory);
assert.match(stored.visionMemory.activeVision.statement, /reduce burden humans carry alone/i);
assert.strictEqual(stored.visionMemory.activeVision.versionLabel, 'Vision v2');
assert(stored.visionMemory.visionVersions.some((vision) => vision.versionLabel === 'Vision v1' && vision.status === 'REPLACED'));

memory = updateVisionMemory(memory, {
  founderMessage: 'Phase 2 product vision: Explain-first. Help users understand before typing through screenshot understanding.'
});
memory = updateVisionMemory(memory, {
  founderMessage: 'Again, Explain-first: understand before typing and screenshot understanding is the active wedge.'
});
const v3 = retrieveActiveVision(memory);
assert.strictEqual(v3.currentVisionVersion, 'Vision v3');
assert.match(v3.currentFounderVision, /Explain-first/i);
assert.strictEqual(v3.visionVersions[0].versionLabel, 'Vision v3');
assert.strictEqual(v3.visionVersions[0].status, 'ACTIVE');
assert.match(v3.visionVersions[1].whyItChanged, /Explain wedge|daily usefulness|newer vision/i);
assert.match(v3.visionVersions[1].whatReplacedIt, /Vision v3: Explain-first/i);

const routeV3 = routeMessage('Bro are we moving toward the dream?', {}, {
  visionMemory: memory
});
assert.match(routeV3.response, /Current Founder Vision: Vision v3: Explain-first/i);
assert.doesNotMatch(routeV3.response, /Founder dream: Destroy loneliness/i);

console.log('Vision memory engine checks passed.');
