const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-hypothesis-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-hypothesis-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-hypothesis-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-hypothesis-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-hypothesis-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-hypothesis-whatsapp-memory-${Date.now()}.json`);

const {
  shouldTrackFounderHypothesis,
  extractFounderHypothesis,
  updateFounderHypothesisMemory
} = require('../founder-hypothesis-tracker');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldTrackFounderHypothesis('Hypothesis: Explain will become a daily habit.'), true);
assert.strictEqual(shouldTrackFounderHypothesis('hi bro'), false);

const explain = extractFounderHypothesis({
  founderMessage: 'Hypothesis: Explain will become a daily habit for confusing screenshots.',
  agentAnswer: 'We need evidence from repeated screenshot sessions before calling this proven.'
});
assert.strictEqual(explain.hypothesisClass, 'EXPLAIN_DAILY_HABIT');
assert.strictEqual(explain.status, 'UNPROVEN');
assert(explain.claim.includes('Explain'));
assert(explain.evidenceNeeded.some((item) => /repeat|daily|retention|usage/i.test(item)));
assert(explain.currentEvidence.some((item) => /not yet|insufficient|needs/i.test(item)));
assert(explain.confidence <= 90);

const confusion = extractFounderHypothesis({
  founderMessage: 'I believe users hate confusion and want the keyboard to explain bills and notices.',
  agentAnswer: 'This is plausible but needs real frequency evidence.'
});
assert.strictEqual(confusion.hypothesisClass, 'USERS_HATE_CONFUSION');
assert.strictEqual(confusion.status, 'PARTIALLY_SUPPORTED');
assert(confusion.evidenceNeeded.some((item) => /frequency|real/i.test(item)));

const distribution = extractFounderHypothesis({
  founderMessage: 'Hypothesis: keyboard is the best distribution vehicle for personal intelligence.',
  agentAnswer: 'Still unproven until activation and retention are measured.'
});
assert.strictEqual(distribution.hypothesisClass, 'KEYBOARD_DISTRIBUTION');
assert.strictEqual(distribution.status, 'UNPROVEN');
assert(distribution.risks.some((item) => /keyboard|distribution|activation/i.test(item)));

let memory = updateFounderHypothesisMemory(null, explain);
memory = updateFounderHypothesisMemory(memory, confusion);
assert.strictEqual(memory.activeHypotheses.length, 2);
assert.strictEqual(memory.lastHypothesis.hypothesisClass, 'USERS_HATE_CONFUSION');
assert.strictEqual(memory.statusCounts.UNPROVEN, 1);
assert.strictEqual(memory.statusCounts.PARTIALLY_SUPPORTED, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Hypothesis: keyboard is the best distribution vehicle for personal intelligence.',
  agentAnswer: 'This needs evidence before we treat it as proven.'
});

const stored = readConversationMemory();
assert(stored.founderHypothesisTracker);
assert.strictEqual(stored.founderHypothesisTracker.lastHypothesis.hypothesisClass, 'KEYBOARD_DISTRIBUTION');
assert.strictEqual(stored.founderHypothesisTracker.lastHypothesis.status, 'UNPROVEN');

console.log('Founder hypothesis tracker checks passed.');
