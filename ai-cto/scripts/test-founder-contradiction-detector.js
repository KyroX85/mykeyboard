const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-contradiction-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-contradiction-whatsapp-memory-${Date.now()}.json`);

const {
  detectFounderContradiction,
  updateFounderContradictions
} = require('../founder-contradiction-detector');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder contradiction detector test');

const priorTracker = {
  currentBeliefs: [
    {
      belief: 'real user leverage and repeatable usefulness matter more than agent sophistication',
      confidence: 82
    }
  ],
  beliefShifts: [],
  assumptions: []
};

const contradiction = detectFounderContradiction({
  founderMessage: 'Maybe agent sophistication matters more than user leverage now.',
  memory: { founderBeliefTracker: priorTracker }
});
assert(contradiction);
assert.strictEqual(contradiction.status, 'POSSIBLE_CONTRADICTION');
assert.match(contradiction.currentStatement, /agent sophistication matters more/i);
assert.match(contradiction.pastBelief, /user leverage/i);
assert.match(contradiction.questionToAsk, /changed your mind|contradiction/i);

const explicitShift = detectFounderContradiction({
  founderMessage: 'I used to think user leverage matters more, but now agent sophistication matters more.',
  memory: { founderBeliefTracker: priorTracker }
});
assert(explicitShift);
assert.strictEqual(explicitShift.status, 'BELIEF_CHANGED');
assert.match(explicitShift.questionToAsk, /treat this as a belief shift/i);

const consistent = detectFounderContradiction({
  founderMessage: 'User leverage still matters more than agent sophistication.',
  memory: { founderBeliefTracker: priorTracker }
});
assert.strictEqual(consistent, null);

let model = updateFounderContradictions(null, contradiction);
model = updateFounderContradictions(model, explicitShift);
assert.strictEqual(model.items.length, 2);
assert.strictEqual(model.unresolvedCount, 1);
assert.strictEqual(model.lastContradiction.status, 'BELIEF_CHANGED');

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Maybe agent sophistication matters more than user leverage now.',
  agentAnswer: 'This sounds like a possible belief change, not a task.',
  founderBeliefTracker: priorTracker
});

const memory = readConversationMemory();
assert(memory.founderContradictions);
assert.strictEqual(memory.founderContradictions.unresolvedCount, 1);
assert.match(memory.founderContradictions.items[0].questionToAsk, /changed your mind|contradiction/i);

console.log('Founder contradiction detector checks passed.');
