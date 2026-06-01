const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-user-value-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-user-value-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-user-value-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-user-value-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-user-value-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-user-value-whatsapp-memory-${Date.now()}.json`);

const {
  judgeUserValue,
  shouldJudgeIdea,
  updateUserValueJudgments
} = require('../user-value-judge');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldJudgeIdea('Build a screenshot Explain flow for confusing bills'), true);
assert.strictEqual(shouldJudgeIdea('hi bro'), false);

const explain = judgeUserValue('Build Explain for confusing screenshots, bills, notices, and forms inside the keyboard.');
assert(explain.totalScore >= 70);
assert.strictEqual(explain.verdict, 'HIGH_USER_VALUE');
assert(explain.questions.wouldUserNotice.score >= 70);
assert(explain.questions.wouldUserCare.score >= 70);
assert(explain.questions.wouldUserReturn.score >= 60);
assert(explain.questions.wouldUserPay.score >= 35);
assert.match(explain.recommendation, /worth/i);

const infra = judgeUserValue('Create a more scalable multi-agent orchestration framework with advanced governance reports.');
assert(infra.totalScore < 45);
assert.strictEqual(infra.verdict, 'LOW_USER_VALUE');
assert(infra.infrastructureRisk >= 70);
assert.match(infra.recommendation, /Do not prioritize|user/i);

const trust = judgeUserValue('Reduce swipe hesitation and correction frustration on compact layouts.');
assert(trust.totalScore >= 55);
assert(trust.trustImpact >= 70);

let memory = updateUserValueJudgments(null, explain);
memory = updateUserValueJudgments(memory, infra);
assert.strictEqual(memory.recentJudgments.length, 2);
assert.strictEqual(memory.lowValueCount, 1);
assert.strictEqual(memory.highValueCount, 1);
assert.strictEqual(memory.lastJudgment.verdict, 'LOW_USER_VALUE');

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Idea: create a more scalable multi-agent orchestration framework with advanced governance reports.',
  agentAnswer: 'This sounds like infrastructure. Judge user value before treating it as progress.'
});

const stored = readConversationMemory();
assert(stored.userValueJudgments);
assert.strictEqual(stored.userValueJudgments.lastJudgment.verdict, 'LOW_USER_VALUE');
assert(stored.userValueJudgments.lastJudgment.infrastructureRisk >= 70);

console.log('User value judge checks passed.');
