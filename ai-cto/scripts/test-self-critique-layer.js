const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-self-critique-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-self-critique-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-self-critique-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-self-critique-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-self-critique-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-self-critique-whatsapp-memory-${Date.now()}.json`);

const {
  shouldSelfCritiqueAnswer,
  generateSelfCritique,
  updateSelfCritiqueMemory
} = require('../self-critique-layer');
const {
  enforceMemoryPolicyOnRoute
} = require('../memory-policy-enforcer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldSelfCritiqueAnswer('Explain will become a daily habit if users see confusing screenshots.'), true);
assert.strictEqual(shouldSelfCritiqueAnswer('ok'), false);

const critique = generateSelfCritique({
  founderMessage: 'Will Explain become daily habit?',
  agentAnswer: 'Explain will become a daily habit because users hate confusion.'
});
assert(critique.whyMightBeWrong.some((item) => /daily habit|evidence|frequency/i.test(item)));
assert(critique.assumptions.some((item) => /users|confusion|habit/i.test(item)));
assert(critique.missingEvidence.some((item) => /retention|repeat|usage|evidence/i.test(item)));
assert(critique.confidence <= 90);

const infraCritique = generateSelfCritique({
  founderMessage: 'Should we build more agent orchestration?',
  agentAnswer: 'This will make the company stronger.'
});
assert(infraCritique.whyMightBeWrong.some((item) => /user-visible|infrastructure|useful/i.test(item)));
assert(infraCritique.missingEvidence.some((item) => /user|product|leverage/i.test(item)));

let memory = updateSelfCritiqueMemory(null, critique);
memory = updateSelfCritiqueMemory(memory, infraCritique);
assert.strictEqual(memory.recentCritiques.length, 2);
assert.strictEqual(memory.lastCritique.answerClass, 'INFRASTRUCTURE_OR_INTERNAL');

const routed = enforceMemoryPolicyOnRoute({
  command: 'conversation',
  response: 'Explain will become a daily habit because users hate confusion.'
}, {
  message: 'Will Explain become daily habit?',
  memory: {}
});
assert(routed.details.selfCritique);
assert(routed.details.selfCritique.whyMightBeWrong.length > 0);
assert(routed.response.includes('Memory Sources Used:'));
assert(!routed.response.includes('Why might this answer be wrong?'));

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Will Explain become daily habit?',
  agentAnswer: 'Explain will become a daily habit because users hate confusion.',
  selfCritique: critique
});

const stored = readConversationMemory();
assert(stored.selfCritiqueMemory);
assert.strictEqual(stored.selfCritiqueMemory.lastCritique.answerClass, 'PHASE2_EXPLAIN');
assert(stored.selfCritiqueMemory.lastCritique.missingEvidence.length > 0);

console.log('Self critique layer checks passed.');
