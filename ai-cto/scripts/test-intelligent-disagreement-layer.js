const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-disagreement-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-disagreement-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-disagreement-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-disagreement-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-disagreement-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-disagreement-memory-${Date.now()}.json`);

const {
  generateStrongestDisagreement,
  applyIntelligentDisagreementToRoute,
  updateIntelligentDisagreementMemory
} = require('../intelligent-disagreement-layer');
const { routeMessage } = require('../whatsapp/command-router');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

const userCare = generateStrongestDisagreement('I think users do not actually care about Explain.', {
  founderPatternDiscovery: {
    lastReport: {
      repeatedFears: [
        { pattern: 'users may not care unless the wedge becomes habitual', evidence: '12 matching signals' }
      ],
      repeatedGoals: [
        { pattern: 'prove Explain creates user-facing leverage', evidence: '9 matching signals' }
      ]
    }
  }
});

assert.strictEqual(userCare.shouldDisagree, true);
assert.strictEqual(userCare.kind, 'USER_VALUE_ASSUMPTION');
assert(userCare.confidence >= 75);
assert.match(userCare.disagreement, /not.*agree|push back|disagree/i);
assert(userCare.evidence.some((item) => /Explain|user-facing|pattern/i.test(item)));

const weak = generateStrongestDisagreement('Maybe we can think about it later.', {});
assert.strictEqual(weak.shouldDisagree, false);
assert(weak.confidence < 75);

const route = applyIntelligentDisagreementToRoute({
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: 'Maybe users do not care. We should observe.'
}, {
  message: 'I think users do not actually care about Explain.',
  memory: {}
});
assert.strictEqual(route.details.intelligentDisagreement.kind, 'USER_VALUE_ASSUMPTION');
assert.match(route.response, /Strongest disagreement:/);
assert.match(route.response, /users do not care/i);

let memory = updateIntelligentDisagreementMemory(null, userCare);
assert.strictEqual(memory.recentDisagreements.length, 1);
assert.strictEqual(memory.lastDisagreement.kind, 'USER_VALUE_ASSUMPTION');

const routed = routeMessage('I think users do not actually care about Explain.', {}, {});
assert.strictEqual(routed.command, 'founder_mind_reconstruction');
assert.match(routed.response, /Strongest disagreement:/);
assert.doesNotMatch(routed.response, /Health|Momentum|TASK_PLAN|APPROVE/i);

updateMemory(routed.command, {}, {
  ...(routed.details || {}),
  founderMessage: 'I think users do not actually care about Explain.',
  agentAnswer: routed.response
});
const stored = readConversationMemory();
assert(stored.intelligentDisagreementMemory);
assert.strictEqual(stored.intelligentDisagreementMemory.lastDisagreement.kind, 'USER_VALUE_ASSUMPTION');

console.log('Intelligent disagreement layer checks passed.');
