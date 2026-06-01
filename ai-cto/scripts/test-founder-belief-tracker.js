const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-belief-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-belief-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-belief-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-belief-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-belief-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-belief-whatsapp-memory-${Date.now()}.json`);

const { routeMessage } = require('../whatsapp/command-router');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');
const {
  extractFounderBeliefShift,
  updateFounderBeliefTracker
} = require('../founder-belief-tracker');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder belief tracker test');

const explicit = extractFounderBeliefShift({
  founderMessage: 'I used to think agents are valuable, but now user leverage matters more.',
  category: 'REFLECTION',
  intent: 'RECONSTRUCT_RECENT_BELIEF_SHIFT'
});
assert(explicit);
assert.match(explicit.beforeBelief, /agents are valuable/i);
assert.match(explicit.afterBelief, /user leverage matters more/i);
assert.strictEqual(explicit.source, 'explicit_founder_statement');

const inferred = extractFounderBeliefShift({
  founderMessage: 'What belief have I changed my mind about recently?',
  category: 'REFLECTION',
  intent: 'RECONSTRUCT_RECENT_BELIEF_SHIFT',
  mindReconstruction: {
    assumption: 'The founder is asking for a behavioral read of how their thinking evolved.',
    concern: 'The system may miss the founder strategic evolution.'
  },
  agentAnswer: [
    'Earlier, the belief was closer to: if the agents become advanced enough, the product will move toward the dream.',
    'Recently, your behavior shows a sharper belief: advanced agents only matter if they produce real user leverage.',
    'The new belief is: the system must prove usefulness through a repeatable product moment, probably Explain.'
  ].join('\n')
});
assert(inferred);
assert.match(inferred.beforeBelief, /agents become advanced enough/i);
assert.match(inferred.afterBelief, /real user leverage|prove usefulness/i);

let tracker = updateFounderBeliefTracker(null, explicit);
tracker = updateFounderBeliefTracker(tracker, inferred);
assert.strictEqual(tracker.beliefShifts.length, 2);
assert(tracker.currentBeliefs.some((item) => /user leverage/i.test(item.belief)));
assert(tracker.assumptions.some((item) => /thinking evolved|strategic evolution/i.test(item.assumption)));

const question = 'What belief have I changed my mind about recently?';
const route = routeMessage(question, {}, readConversationMemory());
assert.strictEqual(route.command, 'founder_mind_reconstruction');
assert.strictEqual(route.details.intent, 'RECONSTRUCT_RECENT_BELIEF_SHIFT');
updateMemory(route.command, {}, {
  ...(route.details || {}),
  founderMessage: question,
  agentAnswer: route.response
});

const memory = readConversationMemory();
assert(memory.founderBeliefTracker);
assert(memory.founderBeliefTracker.beliefShifts.length >= 1);
assert(memory.founderBeliefTracker.currentBeliefs.some((item) => /user leverage|repeatable product moment|usefulness/i.test(item.belief)));

console.log('Founder belief tracker checks passed.');
