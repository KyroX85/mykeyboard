const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-reflection-depth-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-reflection-depth-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-reflection-depth-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-reflection-depth-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-reflection-depth-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-reflection-depth-memory-${Date.now()}.json`);

const {
  buildReflectionDepth,
  formatReflectionDepth,
  responseUsesReflectionDepth
} = require('../reflection-depth-layer');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'reflection depth layer test');

const avoidance = buildReflectionDepth({
  message: "Bro what do you think I'm avoiding right now?",
  archetype: 'founder_avoidance'
});
assert.strictEqual(avoidance.domain, 'avoidance');
assert.match(avoidance.surfaceAnswer, /user-proof/i);
assert.match(avoidance.deeperAnswer, /killer feature/i);
assert.match(avoidance.uncomfortableAnswer, /smarter|company/i);
assert.match(avoidance.hiddenAssumption, /agents/i);
assert(responseUsesReflectionDepth(formatReflectionDepth(avoidance)));

const dissatisfied = buildReflectionDepth({
  message: 'Bro why am I not satisfied with this feature?',
  archetype: 'dissatisfaction'
});
assert.strictEqual(dissatisfied.domain, 'dissatisfaction');
assert.match(dissatisfied.surfaceAnswer, /meaningful user outcome/i);
assert.match(dissatisfied.deeperAnswer, /value gap|habit/i);
assert.match(dissatisfied.uncomfortableAnswer, /functional|miss/i);

const routed = routeMessage("Bro what do you think I'm avoiding right now?", {}, {});
assert.strictEqual(routed.command, 'founder_mind_reconstruction');
assert.strictEqual(routed.details.category, 'REFLECTION');
assert(responseUsesReflectionDepth(routed.response));
assert.match(routed.response, /Surface answer:/);
assert.match(routed.response, /Deeper answer:/);
assert.match(routed.response, /Uncomfortable answer:/);
assert.match(routed.response, /Hidden assumption:/);
assert.match(routed.response, /user-proof|killer feature|users do not care/i);
assert.doesNotMatch(routed.response, /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|Files:|Validation:/i);

const dissatisfiedRoute = routeMessage('Bro why am I not satisfied with this feature?', {}, {});
assert.strictEqual(dissatisfiedRoute.details.category, 'REFLECTION');
assert(responseUsesReflectionDepth(dissatisfiedRoute.response));
assert.match(dissatisfiedRoute.response, /meaningful user outcome|value gap|would not miss/i);
assert.doesNotMatch(dissatisfiedRoute.response, /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|Files:|Validation:/i);

console.log('Reflection depth layer checks passed.');
