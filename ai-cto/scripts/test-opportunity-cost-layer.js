const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-opportunity-cost-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-opportunity-cost-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-opportunity-cost-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-opportunity-cost-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-opportunity-cost-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-opportunity-cost-whatsapp-memory-${Date.now()}.json`);

const {
  shouldEvaluateOpportunityCost,
  evaluateOpportunityCost,
  updateOpportunityCostMemory
} = require('../opportunity-cost-layer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldEvaluateOpportunityCost('Build Explain for confusing screenshots and bills'), true);
assert.strictEqual(shouldEvaluateOpportunityCost('hi bro'), false);

const explain = evaluateOpportunityCost('Build Explain for confusing screenshots and bills inside keyboard');
assert.strictEqual(explain.initiativeClass, 'PHASE2_EXPLAIN');
assert(explain.notDoing.some((item) => /draft|reply|execution layer|keyboard/i.test(item)));
assert(explain.delayedUserProblems.some((item) => /typing|swipe|foundation|draft|reply|user/i.test(item)));
assert(explain.lostLeverage.some((item) => /workflow|habit|daily|leverage/i.test(item)));
assert(explain.tradeoffSeverity);
assert(explain.confidence <= 90);

const infra = evaluateOpportunityCost('Create scalable multi-agent orchestration framework and governance reports');
assert.strictEqual(infra.initiativeClass, 'INFRASTRUCTURE_HEAVY');
assert(infra.notDoing.some((item) => /Explain|user-facing|product/i.test(item)));
assert(infra.delayedUserProblems.some((item) => /confusing|screenshot|message|user/i.test(item)));
assert.match(infra.recommendation, /user-visible|do not prioritize/i);

const hotPath = evaluateOpportunityCost('Rewrite prediction to make typing smarter');
assert.strictEqual(hotPath.initiativeClass, 'HOT_PATH_KEYBOARD');
assert(hotPath.notDoing.some((item) => /Explain|Phase 2|execution/i.test(item)));
assert(hotPath.delayedUserProblems.some((item) => /understand|screenshot|confusing/i.test(item)));

let memory = updateOpportunityCostMemory(null, explain);
memory = updateOpportunityCostMemory(memory, infra);
assert.strictEqual(memory.recentOpportunityCosts.length, 2);
assert.strictEqual(memory.lastOpportunityCost.initiativeClass, 'INFRASTRUCTURE_HEAVY');
assert.strictEqual(memory.classCounts.PHASE2_EXPLAIN, 1);
assert.strictEqual(memory.classCounts.INFRASTRUCTURE_HEAVY, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Initiative: Create scalable multi-agent orchestration framework and governance reports.',
  agentAnswer: 'Evaluate what product work gets delayed first.'
});

const stored = readConversationMemory();
assert(stored.opportunityCostMemory);
assert.strictEqual(stored.opportunityCostMemory.lastOpportunityCost.initiativeClass, 'INFRASTRUCTURE_HEAVY');
assert(stored.opportunityCostMemory.lastOpportunityCost.lostLeverage.length > 0);

console.log('Opportunity cost layer checks passed.');
