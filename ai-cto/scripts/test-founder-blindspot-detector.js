const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-blindspot-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-blindspot-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-blindspot-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-blindspot-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-blindspot-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-blindspot-memory-${Date.now()}.json`);

const {
  detectFounderBlindspots,
  updateFounderBlindspotMemory,
  formatBlindspotSummary
} = require('../founder-blindspot-detector');
const {
  writeMemory,
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder blindspot detector test');

const memory = {
  founderDoubts: [
    { concern: "I don't think users actually care about this." },
    { concern: 'What if users never use this product?' },
    { concern: 'The real issue is adoption and daily habit.' },
    { concern: 'Users may not return unless Explain removes a repeated pain.' },
    { concern: 'I am scared this is impressive instead of useful.' },
    { concern: 'This looks advanced but maybe not useful.' },
    { concern: 'I think we are focusing on the wrong thing.' },
    { concern: 'Maybe this is too much infrastructure and not closer to the dream.' }
  ],
  founderFeedback: [
    { feedback: 'wrong route', answerPattern: 'Health 30 Momentum stalled generic CTO mode' },
    { feedback: 'too generic', answerPattern: 'team ready status template' },
    { feedback: 'not useful', answerPattern: 'agent template did not answer users care question' }
  ],
  recentMessages: [
    { founderMessage: 'Bro are we even moving toward the dream?' },
    { founderMessage: "Bro what if my dream itself is wrong?" },
    { founderMessage: 'Do my agents really understand or are they keyword based?' }
  ]
};

const detection = detectFounderBlindspots(memory);
assert(detection.recurringBlindspots.length >= 3);
assert.strictEqual(detection.topBlindspot.id, 'adoption_fear_loop');
assert(detection.topBlindspot.count >= 2);
assert(detection.recurringFears.some((item) => item.id === 'impressive_not_useful_loop'));
assert(detection.recurringFrustrations.some((item) => item.id === 'agent_intelligence_distrust_loop'));
assert.match(formatBlindspotSummary(detection.topBlindspot), /You have returned to adoption fear \d+ times recently/i);

const updated = updateFounderBlindspotMemory(null, memory);
assert(updated.activeBlindspots.length >= 3);
assert.strictEqual(updated.lastDetection.topBlindspot.id, 'adoption_fear_loop');

writeMemory(memory);
let stored = readConversationMemory();
assert(stored.founderBlindspotDetector);
assert.strictEqual(stored.founderBlindspotDetector.lastDetection.topBlindspot.id, 'adoption_fear_loop');

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: "I don't think users actually care.",
  agentAnswer: 'That is a real risk. The test is repeated user pull.',
  intent: 'RECONSTRUCT_USER_VALUE_DOUBT',
  category: 'DOUBT',
  mindReconstruction: {
    objective: 'Test whether users care.',
    assumption: 'User care is unproven.',
    concern: 'Adoption may be weak.',
    decision: 'Do not confuse impressive systems with useful product.',
    desiredOutcome: 'Name user pull evidence.',
    actualQuestion: 'Do users care?'
  }
});
stored = readConversationMemory();
assert(stored.founderBlindspotDetector.lastDetection.recurringBlindspots.some((item) => item.id === 'adoption_fear_loop'));

console.log('Founder blindspot detector checks passed.');
