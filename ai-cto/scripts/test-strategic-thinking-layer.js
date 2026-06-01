const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-strategic-thinking-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-strategic-thinking-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-strategic-thinking-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-strategic-thinking-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-strategic-thinking-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-strategic-thinking-whatsapp-memory.json');

const {
  buildStrategicThinking,
  formatStrategicThinking,
  responseUsesStrategicThinking
} = require('../strategic-thinking-layer');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'strategic thinking layer test');

const visionThinking = buildStrategicThinking({
  message: "Bro are we even moving toward the dream?"
});
assert.strictEqual(visionThinking.domain, 'vision_alignment');
assert.match(visionThinking.firstOrderConsequence, /operating discipline|breakthrough/i);
assert.match(visionThinking.opportunityCost, /agent plumbing|Explain/i);
assert.match(formatStrategicThinking(visionThinking), /Alternative path:/);

const explainThinking = buildStrategicThinking({
  message: 'Should Explain handle screenshots?'
});
assert.strictEqual(explainThinking.domain, 'phase2_explain');
assert.match(explainThinking.secondOrderConsequence, /understanding-before-typing/i);

const dreamRoute = routeMessage("Bro are we even moving toward the dream?", {}, {});
assert.strictEqual(dreamRoute.command, 'founder_mind_reconstruction');
assert(responseUsesStrategicThinking(dreamRoute.response));
assert.match(dreamRoute.response, /Opportunity cost: Every day spent on agent plumbing/i);
assert.doesNotMatch(dreamRoute.response, /TASK_PLAN|APPROVE|Health:\s*\d+|Momentum/i);

const productRoute = routeMessage('What are we actually trying to build?', {}, {});
assert.strictEqual(productRoute.command, 'founder_objective_understanding');
assert(responseUsesStrategicThinking(productRoute.response));
assert.match(productRoute.response, /First-order consequence:/);
assert.match(productRoute.response, /Alternative path:/);

console.log('Strategic thinking layer checks passed');
