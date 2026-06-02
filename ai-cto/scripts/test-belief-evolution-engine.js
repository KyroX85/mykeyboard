const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-belief-evolution-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-belief-evolution-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-belief-evolution-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-belief-evolution-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-belief-evolution-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-belief-evolution-whatsapp-memory-${Date.now()}.json`);

const {
  recordBeliefEvolution,
  retrieveEvolvedBelief,
  formatEvolvedBeliefForResponse
} = require('../belief-evolution-engine');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'belief evolution engine test');

let memory = recordBeliefEvolution(null, {
  previousBelief: 'Better agents create value.',
  currentBelief: 'Only user leverage creates value.',
  evidence: [
    'Founder repeatedly rejected health reports and architecture theater.',
    'Founder asked whether users actually care.'
  ],
  strategicConsequences: [
    'Infrastructure progress is not company progress.',
    'Every feature must prove repeated user pull.'
  ],
  tags: ['agents', 'user leverage', 'infrastructure', 'company progress']
});

assert.strictEqual(memory.version, '1.0');
assert.strictEqual(memory.evolvedBeliefs.length, 1);
assert.match(memory.evolvedBeliefs[0].previousBelief, /Better agents/i);
assert.match(memory.evolvedBeliefs[0].currentBelief, /Only user leverage/i);
assert.match(memory.evolvedBeliefs[0].strategicConsequences[0], /Infrastructure progress/i);

const retrieval = retrieveEvolvedBelief('Do smarter agents make the company more valuable?', memory);
assert(retrieval.matched);
assert.match(retrieval.currentBelief, /Only user leverage creates value/i);
assert.match(retrieval.strategicConsequences.join(' '), /Infrastructure progress is not company progress/i);
assert(retrieval.confidence <= 90);

const formatted = formatEvolvedBeliefForResponse(retrieval);
assert.match(formatted, /Evolved belief:/);
assert.match(formatted, /Previous:/);
assert.match(formatted, /Current:/);
assert.match(formatted, /Why it changed:/);
assert.match(formatted, /Strategic consequence:/);

const route = routeMessage('Do smarter agents make the company more valuable?', {}, {
  beliefEvolution: memory
});
assert.strictEqual(route.command, 'founder_mind_reconstruction');
assert.match(route.response, /Only user leverage creates value/i);
assert.match(route.response, /Infrastructure progress is not company progress/i);
assert.doesNotMatch(route.response, /Health:\s*\d+|Momentum:\s*|TASK_PLAN|APPROVE|Execution Plan/i);

console.log('Belief evolution engine checks passed.');
