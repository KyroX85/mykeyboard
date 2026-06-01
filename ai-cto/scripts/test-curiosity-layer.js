const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-curiosity-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-curiosity-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-curiosity-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-curiosity-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-curiosity-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-curiosity-whatsapp-memory.json');

const {
  buildCuriosityPrompt,
  formatCuriosityPrompt,
  responseUsesRealCuriosity
} = require('../curiosity-layer');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'curiosity layer test');

const dissatisfaction = buildCuriosityPrompt({
  message: "I don't like this feature.",
  confidence: 82
});
assert.strictEqual(dissatisfaction.shouldAsk, true);
assert.strictEqual(dissatisfaction.domain, 'dissatisfaction');
assert.match(formatCuriosityPrompt(dissatisfaction), /capability, design, trust, or emotional reaction/i);

const highConfidence = buildCuriosityPrompt({
  message: 'What are we building?',
  confidence: 90
});
assert.strictEqual(highConfidence.shouldAsk, false);

const routed = routeMessage("I don't like this feature.", {}, {});
assert.strictEqual(routed.command, 'founder_mind_reconstruction');
assert(responseUsesRealCuriosity(routed.response));
assert.match(routed.response, /Useful follow-up: Is the issue capability, design, trust, or emotional reaction\?/);
assert.doesNotMatch(routed.response, /What feature\?|please clarify|provide more details|AMBIGUOUS INTENT/i);
assert.doesNotMatch(routed.response, /TASK_PLAN|APPROVE|Execution Plan|Health:\s*\d+|Momentum/i);

const strategicDoubt = routeMessage("Something feels off with our direction.", {}, {});
assert.strictEqual(strategicDoubt.command, 'founder_mind_reconstruction');
assert(responseUsesRealCuriosity(strategicDoubt.response));
assert.match(strategicDoubt.response, /killer user moment|infrastructure/i);

console.log('Curiosity layer checks passed');
