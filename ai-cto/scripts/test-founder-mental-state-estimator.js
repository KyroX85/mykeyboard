const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-mental-state-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-mental-state-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-mental-state-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-mental-state-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-mental-state-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-mental-state-whatsapp-memory-${Date.now()}.json`);

const {
  estimateFounderMentalState,
  updateFounderMentalStateMemory
} = require('../founder-mental-state-estimator');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

const samples = [
  {
    message: 'I keep replaying my own decisions and trying to understand the pattern.',
    state: 'REFLECTION',
    route: 'FOUNDER_REFLECTION'
  },
  {
    message: 'Something in this direction does not sit right with me.',
    state: 'DOUBT',
    route: 'FOUNDER_DOUBT'
  },
  {
    message: 'If this works, people should use the keyboard as their phone intelligence layer.',
    state: 'VISION',
    route: 'FOUNDER_VISION'
  },
  {
    message: 'If we spend six months here, what do we lose elsewhere?',
    state: 'STRATEGY',
    route: 'FOUNDER_STRATEGY'
  },
  {
    message: 'This answer is making me tired because it keeps missing what I mean.',
    state: 'FRUSTRATION',
    route: 'FOUNDER_FRUSTRATION'
  },
  {
    message: 'What would change if users actually liked this?',
    state: 'CURIOSITY',
    route: 'FOUNDER_CURIOSITY'
  }
];

for (const sample of samples) {
  const estimate = estimateFounderMentalState(sample.message);
  assert.strictEqual(estimate.primaryState, sample.state, sample.message);
  assert.strictEqual(estimate.routingHint, sample.route, sample.message);
  assert(estimate.confidence <= 90, 'mental state confidence must stay honest');
  assert(estimate.signals.length > 0, 'mental state estimate should explain its signal');
  assert(!/health|momentum|task plan|approve/i.test(estimate.responseGuidance), 'guidance must stay conversational');
}

let mentalStateMemory = updateFounderMentalStateMemory(null, estimateFounderMentalState(samples[0].message));
mentalStateMemory = updateFounderMentalStateMemory(mentalStateMemory, estimateFounderMentalState(samples[4].message));
assert.strictEqual(mentalStateMemory.recentStates.length, 2);
assert.strictEqual(mentalStateMemory.lastState.primaryState, 'FRUSTRATION');
assert.strictEqual(mentalStateMemory.stateCounts.REFLECTION, 1);
assert.strictEqual(mentalStateMemory.stateCounts.FRUSTRATION, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Something in this direction does not sit right with me.',
  agentAnswer: 'This is hidden concern, not an execution request.'
});

const stored = readConversationMemory();
assert(stored.founderMentalStateMemory);
assert.strictEqual(stored.founderMentalStateMemory.lastState.primaryState, 'DOUBT');
assert.strictEqual(stored.founderMentalStateMemory.lastState.routingHint, 'FOUNDER_DOUBT');

console.log('Founder mental state estimator checks passed.');
