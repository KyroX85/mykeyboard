const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-founder-identity-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-founder-identity-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-founder-identity-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-founder-identity-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-founder-identity-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-founder-identity-whatsapp-memory-${Date.now()}.json`);

const {
  reconstructFounderIdentity,
  formatFounderIdentityTrajectory
} = require('../founder-identity-reconstruction-engine');
const { recordBeliefEvolution } = require('../belief-evolution-engine');
const { updatePrincipleMemory } = require('../principle-extraction-engine');
const { updateStrategicMemory } = require('../strategic-memory-layer');
const { updateVisionMemory } = require('../vision-memory-engine');
const { updateFounderWorldModel } = require('../founder-world-model-engine');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder identity reconstruction test');

let visionMemory = updateVisionMemory(null, {
  founderMessage: 'Old vision: destroy loneliness through an AI companion.'
});
visionMemory = updateVisionMemory(visionMemory, {
  founderMessage: 'Old vision again: destroy loneliness through an AI companion.'
});
visionMemory = updateVisionMemory(visionMemory, {
  founderMessage: 'Current vision: reduce burden humans carry alone. Humans choose direction; AI executes. Trust over capability. Freedom over dependency.'
});
visionMemory = updateVisionMemory(visionMemory, {
  founderMessage: 'Again current vision: reduce burden humans carry alone. Humans choose direction; AI executes. Trust over capability. Freedom over dependency.'
});

const founderWorldModel = updateFounderWorldModel(null, {
  founderMessage: 'Current founder worldview: reduce burden humans carry alone. Humans choose direction; AI executes. Trust over capability. Freedom over dependency.',
  visionMemory
});

const beliefEvolution = recordBeliefEvolution(null, {
  previousBelief: 'advanced agents create value by becoming more capable',
  currentBelief: 'advanced agents only matter if they create real user leverage',
  evidence: ['Founder repeatedly rejected fake progress, status reports, and infrastructure theatre.'],
  strategicConsequences: ['Infrastructure progress is not company progress.'],
  confidence: 84
});

const founderPrinciples = updatePrincipleMemory(null, [
  { feedback: 'bad answer', failureReason: 'health reports and task plans were not useful' },
  { feedback: 'too generic', failureReason: 'generic CTO language missed product truth' },
  { feedback: 'good answer', successReason: 'strategic truth over operational reporting' }
]);

const strategicMemory = updateStrategicMemory(null, {
  founderMessage: 'Lesson: useful intelligence must prove repeated user pull, not just system sophistication.',
  agentAnswer: 'The product must prove daily habit and user value.'
});

const memory = {
  visionMemory,
  founderWorldModel,
  beliefEvolution,
  founderPrinciples,
  strategicMemory,
  founderContradictions: {
    lastContradiction: {
      contradiction: 'Wanting humans to be free while asking Jarvis to do everything can become dependency unless humans keep direction.'
    }
  }
};

const identity = reconstructFounderIdentity({
  question: 'Who am I becoming?',
  memory
});

assert.match(identity.oldIdentity, /advanced agents create value|destroy loneliness|builder/i);
assert.match(identity.emergingIdentity, /real user leverage|product truth|principle|contradiction/i);
assert.match(identity.currentIdentity, /trusted phone-native intelligence layer|humans choose direction|agency|leverage/i);
assert(identity.evidence.some((item) => /belief evolution/i.test(item)));
assert(identity.evidence.some((item) => /active vision/i.test(item)));
assert(identity.confidence >= 70 && identity.confidence <= 88);

const formatted = formatFounderIdentityTrajectory(identity);
assert.match(formatted, /Founder Identity Trajectory:/);
assert.match(formatted, /Old identity:/);
assert.match(formatted, /Emerging identity:/);
assert.match(formatted, /Current identity:/);

for (const prompt of [
  'Who am I becoming?',
  'What motivates me?',
  'What am I optimizing for?',
  'What belief changed?'
]) {
  const route = routeMessage(prompt, {}, memory);
  assert.strictEqual(route.command, 'founder_mind_reconstruction', prompt);
  assert.match(route.response, /Founder Identity Trajectory:/, prompt);
  assert.match(route.response, /Old identity:/, prompt);
  assert.match(route.response, /Emerging identity:/, prompt);
  assert.match(route.response, /Current identity:/, prompt);
  assert.doesNotMatch(route.response, /TASK_PLAN|APPROVE|Health|Momentum|Execution Plan|Team Ready/i, prompt);
}

console.log('Founder identity reconstruction engine checks passed.');
