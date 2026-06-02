const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-contrarian-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-contrarian-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-contrarian-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-contrarian-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-contrarian-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-contrarian-memory-${Date.now()}.json`);

const {
  buildContrarianReasoning,
  formatContrarianReasoning,
  responseUsesContrarianReasoning
} = require('../contrarian-reasoning-layer');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'contrarian reasoning layer test');

const vision = buildContrarianReasoning({
  message: 'Bro are we moving toward the dream?'
});
assert.strictEqual(vision.domain, 'vision_alignment');
assert.match(vision.strongestCaseFor, /discipline|execution safety/i);
assert.match(vision.strongestCaseAgainst, /user-facing reason|unproven/i);
assert.match(vision.likelyReality, /Explain|product pull/i);
assert(responseUsesContrarianReasoning(formatContrarianReasoning(vision)));

const userValue = buildContrarianReasoning({
  message: "I think users don't care."
});
assert.strictEqual(userValue.domain, 'user_value');
assert.match(userValue.strongestCaseFor, /confusing moments/i);
assert.match(userValue.strongestCaseAgainst, /switch keyboards|optional/i);
assert.match(userValue.likelyReality, /repeated use case|trust advantage/i);

const dreamRoute = routeMessage('Bro are we moving toward the dream?', {}, {});
assert.strictEqual(dreamRoute.command, 'founder_mind_reconstruction');
assert(responseUsesContrarianReasoning(dreamRoute.response));
assert.match(dreamRoute.response, /Strongest case for:/);
assert.match(dreamRoute.response, /Strongest case against:/);
assert.match(dreamRoute.response, /Likely reality:/);
assert.doesNotMatch(dreamRoute.response, /TASK_PLAN|APPROVE|Health:\s*\d+|Momentum|Team is ready/i);

const productRoute = routeMessage('What are we actually trying to build?', {}, {});
assert.strictEqual(productRoute.command, 'founder_objective_understanding');
assert(responseUsesContrarianReasoning(productRoute.response));
assert.match(productRoute.response, /Strongest case against:/);
assert.doesNotMatch(productRoute.response, /TASK_PLAN|APPROVE|Health:\s*\d+|Momentum|Team is ready/i);

console.log('Contrarian reasoning layer checks passed.');
