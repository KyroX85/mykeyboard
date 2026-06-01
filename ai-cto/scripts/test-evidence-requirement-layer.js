const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-evidence-requirement-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-evidence-requirement-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-evidence-requirement-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-evidence-requirement-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-evidence-requirement-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-evidence-requirement-whatsapp-memory-${Date.now()}.json`);

const {
  shouldRequireEvidence,
  evaluateEvidenceRequirement,
  updateEvidenceRequirementMemory
} = require('../evidence-requirement-layer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

const strongClaim = 'You are optimizing for product truth over comfort, and the agents clearly understand your founder dream.';
assert.strictEqual(shouldRequireEvidence(strongClaim), true);
assert.strictEqual(shouldRequireEvidence('Maybe.'), false);

const missing = evaluateEvidenceRequirement(strongClaim, {});
assert.strictEqual(missing.status, 'DOWNGRADE_REQUIRED');
assert(missing.missingEvidence.includes('memory evidence'));
assert(missing.missingEvidence.includes('conversation evidence'));
assert(missing.missingEvidence.includes('behavior evidence'));
assert.match(missing.claimGuidance, /downgrade|uncertain/i);
assert(missing.confidence <= 90);

const supported = evaluateEvidenceRequirement(strongClaim, {
  founderMemory: {
    founderGoals: ['trusted phone intelligence layer'],
    founderRejectedPatterns: ['fake progress', 'architecture theatre']
  },
  founderMessage: 'Based on my behavior, what am I optimizing for?',
  recentMessages: [
    { founderMessage: 'I am scared we are building something impressive instead of useful.' }
  ],
  behaviorEvidence: [
    'Founder repeatedly rejects generic templates.',
    'Founder asks for tests after bad WhatsApp answers.'
  ]
});
assert.strictEqual(supported.status, 'EVIDENCE_SUPPORTED');
assert.strictEqual(supported.missingEvidence.length, 0);
assert(supported.evidence.memory.length > 0);
assert(supported.evidence.conversation.length > 0);
assert(supported.evidence.behavior.length > 0);

let evidenceMemory = updateEvidenceRequirementMemory(null, missing);
evidenceMemory = updateEvidenceRequirementMemory(evidenceMemory, supported);
assert.strictEqual(evidenceMemory.recentChecks.length, 2);
assert.strictEqual(evidenceMemory.lastCheck.status, 'EVIDENCE_SUPPORTED');
assert.strictEqual(evidenceMemory.statusCounts.DOWNGRADE_REQUIRED, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Do I care about product truth?',
  agentAnswer: strongClaim,
  founderMemory: {
    founderGoals: ['trusted phone intelligence layer']
  },
  behaviorEvidence: [
    'Founder rejected fake progress and irrelevant templates.'
  ]
});

const stored = readConversationMemory();
assert(stored.evidenceRequirementMemory);
assert.strictEqual(stored.evidenceRequirementMemory.lastCheck.status, 'EVIDENCE_SUPPORTED');
assert(stored.evidenceRequirementMemory.lastCheck.evidence.memory.length > 0);
assert(stored.evidenceRequirementMemory.lastCheck.evidence.behavior.length > 0);

console.log('Evidence requirement layer checks passed.');
