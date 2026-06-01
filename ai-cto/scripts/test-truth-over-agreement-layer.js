const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-truth-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-truth-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-truth-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-truth-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-truth-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-truth-whatsapp-memory-${Date.now()}.json`);

const {
  shouldEvaluateTruthOverAgreement,
  evaluateTruthOverAgreement,
  updateTruthOverAgreementMemory
} = require('../truth-over-agreement-layer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldEvaluateTruthOverAgreement('I think users do not actually care about Explain.'), true);
assert.strictEqual(shouldEvaluateTruthOverAgreement('hi bro'), false);

const userCare = evaluateTruthOverAgreement('I think users do not actually care about Explain.');
assert.strictEqual(userCare.stance, 'DISAGREE_WITH_ASSUMPTION');
assert(userCare.disagreement.length > 0);
assert(userCare.evidence.some((item) => /Explain|confusing|user pain|evidence/i.test(item)));
assert(userCare.truthRisk.some((item) => /approval|agreement|false/i.test(item)));
assert(userCare.confidence <= 90);

const infra = evaluateTruthOverAgreement('I want to build a scalable multi-agent orchestration framework because it sounds impressive.');
assert.strictEqual(infra.stance, 'DISAGREE_WITH_DIRECTION');
assert(infra.disagreement.some((item) => /user-visible|infrastructure|useful/i.test(item)));
assert.match(infra.recommendation, /do not agree|challenge/i);

const hotPath = evaluateTruthOverAgreement('Let us rewrite prediction to make it smarter without evidence.');
assert.strictEqual(hotPath.stance, 'DISAGREE_WITH_EXECUTION');
assert(hotPath.disagreement.some((item) => /typing trust|foundation|evidence/i.test(item)));

const aligned = evaluateTruthOverAgreement('We should protect Phase 1 and test Explain with screenshot evidence.');
assert.strictEqual(aligned.stance, 'AGREE_WITH_EVIDENCE');
assert(aligned.truthRisk.some((item) => /still/i.test(item)));

let memory = updateTruthOverAgreementMemory(null, userCare);
memory = updateTruthOverAgreementMemory(memory, infra);
assert.strictEqual(memory.recentTruthChecks.length, 2);
assert.strictEqual(memory.lastTruthCheck.stance, 'DISAGREE_WITH_DIRECTION');
assert.strictEqual(memory.stanceCounts.DISAGREE_WITH_ASSUMPTION, 1);
assert.strictEqual(memory.stanceCounts.DISAGREE_WITH_DIRECTION, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'I want to build a scalable multi-agent orchestration framework because it sounds impressive.',
  agentAnswer: 'Truth over agreement should challenge this.'
});

const stored = readConversationMemory();
assert(stored.truthOverAgreementMemory);
assert.strictEqual(stored.truthOverAgreementMemory.lastTruthCheck.stance, 'DISAGREE_WITH_DIRECTION');
assert(stored.truthOverAgreementMemory.lastTruthCheck.disagreement.length > 0);

console.log('Truth over agreement layer checks passed.');
