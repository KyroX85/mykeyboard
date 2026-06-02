const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-premortem-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-premortem-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-premortem-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-premortem-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-premortem-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-premortem-whatsapp-memory-${Date.now()}.json`);

const {
  shouldRunPremortem,
  generatePremortem,
  formatPremortemAnalysis,
  responseUsesPremortemAnalysis,
  updatePremortemMemory
} = require('../premortem-engine');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldRunPremortem('Build Explain for confusing screenshots and bills inside keyboard'), true);
assert.strictEqual(shouldRunPremortem('If we fail in 3 years, why do we fail?'), true);
assert.strictEqual(shouldRunPremortem('What could kill this?'), true);
assert.strictEqual(shouldRunPremortem('hi bro'), false);

const explain = generatePremortem('Build Explain for confusing screenshots and bills inside keyboard');
assert.strictEqual(explain.decisionClass, 'PHASE2_EXPLAIN');
assert(explain.failureModes.length > 0);
assert.match(explain.mostLikelyFailure, /habit|daily/i);
assert.match(explain.hiddenFailure, /existing|workflow|familiar/i);
assert.match(explain.ignoredFailure, /permission|privacy|latency/i);
assert.match(explain.founderCausedFailure, /broaden|companion|repeatable/i);
assert(responseUsesPremortemAnalysis(formatPremortemAnalysis(explain)));
assert(explain.blindSpots.length > 0);
assert(explain.executionRisks.length > 0);
assert(explain.trustRisks.length > 0);
assert(explain.confidence <= 90);
assert(explain.trustRisks.some((risk) => /screenshot|privacy|typing trust/i.test(risk)));

const infra = generatePremortem('Create scalable multi-agent orchestration framework and governance reports');
assert.strictEqual(infra.decisionClass, 'INFRASTRUCTURE_HEAVY');
assert(infra.failureModes.some((risk) => /infrastructure|user-facing|theater/i.test(risk)));
assert(infra.recommendation.includes('user-visible'));

const hotPath = generatePremortem('Rewrite prediction to make typing smarter');
assert.strictEqual(hotPath.decisionClass, 'HOT_PATH_KEYBOARD');
assert(hotPath.trustRisks.some((risk) => /typing trust|prediction|latency/i.test(risk)));
assert(hotPath.executionRisks.some((risk) => /hot path|rollback|regression/i.test(risk)));

let memory = updatePremortemMemory(null, explain);
memory = updatePremortemMemory(memory, infra);
assert.strictEqual(memory.recentPremortems.length, 2);
assert.strictEqual(memory.lastPremortem.decisionClass, 'INFRASTRUCTURE_HEAVY');
assert.strictEqual(memory.classCounts.PHASE2_EXPLAIN, 1);
assert.strictEqual(memory.classCounts.INFRASTRUCTURE_HEAVY, 1);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Decision: Build Explain for confusing screenshots and bills inside keyboard.',
  agentAnswer: 'Premortem before implementation.'
});

const stored = readConversationMemory();
assert(stored.premortemMemory);
assert.strictEqual(stored.premortemMemory.lastPremortem.decisionClass, 'PHASE2_EXPLAIN');
assert(stored.premortemMemory.lastPremortem.failureModes.length > 0);
assert(stored.premortemMemory.lastPremortem.mostLikelyFailure);

console.log('Premortem engine checks passed.');
