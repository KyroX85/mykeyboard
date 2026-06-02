const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-advisor-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-advisor-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-advisor-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-advisor-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-advisor-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-advisor-whatsapp-memory.json');

const {
  shouldUseAdvisorMode,
  buildAdvisorMode,
  formatAdvisorMode,
  responseUsesAdvisorMode
} = require('../advisor-mode');
const { buildStrategicThinking } = require('../strategic-thinking-layer');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'advisor mode test');

const strategicThinking = buildStrategicThinking({
  message: 'What happens if we focus only on the execution layer for 6 months?'
});
const advisor = buildAdvisorMode({
  message: 'What happens if we focus only on the execution layer for 6 months?',
  category: 'DOUBT',
  intent: 'RECONSTRUCT_STRATEGIC_MISALIGNMENT_CONCERN',
  strategicThinking
});

assert.strictEqual(shouldUseAdvisorMode({
  message: 'Bro are we moving toward the dream?',
  category: 'VISION',
  intent: 'RECONSTRUCT_VISION_ALIGNMENT_CONCERN'
}), true);
assert.strictEqual(shouldUseAdvisorMode({
  message: 'implement this now',
  category: 'FOUNDER_EXECUTION',
  intent: 'EXECUTE'
}), false);
assert.match(formatAdvisorMode(advisor), /Advisor Mode:/);
assert.match(formatAdvisorMode(advisor), /Long-term consequence:/);
assert.match(formatAdvisorMode(advisor), /Opportunity cost:/);
assert.match(formatAdvisorMode(advisor), /Leverage:/);
assert.match(formatAdvisorMode(advisor), /Strategic truth:/);
assert.match(formatAdvisorMode(advisor), /Recommendation:/);
assert(responseUsesAdvisorMode(formatAdvisorMode(advisor)));

const prompts = [
  'Bro are we moving toward the dream?',
  "Bro I think we're focusing on the wrong thing.",
  'What happens if we focus only on the execution layer for 6 months?',
  "What's the most dangerous assumption?",
  'Bro, if you had to disagree with me right now, what would you disagree with?'
];

for (const prompt of prompts) {
  const route = routeMessage(prompt, {}, {});
  assert.strictEqual(route.command, 'founder_mind_reconstruction', prompt);
  assert(responseUsesAdvisorMode(route.response), prompt);
  assert.match(route.response, /Long-term consequence:/, prompt);
  assert.match(route.response, /Opportunity cost:/, prompt);
  assert.match(route.response, /Leverage:/, prompt);
  assert.match(route.response, /Strategic truth:/, prompt);
  assert.doesNotMatch(route.response, /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|Files:|Validation:|Scope:/i, prompt);
}

console.log('Advisor mode checks passed');
