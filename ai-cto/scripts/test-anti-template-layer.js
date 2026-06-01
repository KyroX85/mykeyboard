const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-anti-template-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-anti-template-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-anti-template-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-anti-template-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-anti-template-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-anti-template-whatsapp-memory.json');

const { routeMessage } = require('../whatsapp/command-router');
const {
  enforceAntiTemplateOnRoute,
  containsForbiddenTemplate
} = require('../whatsapp/anti-template-layer');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'anti-template layer test');

const forbidden = /(Health\s*:?\s*\d{1,3}|Momentum\s*:?\s*STALLED|Team\s+(is\s+)?ready|Review Gate|Current Foundation Health|complexity report)/i;

const dissatisfied = routeMessage('Bro why am I not satisfied with this feature?', {}, {});
assert.strictEqual(dissatisfied.matchedRoute, 'founder_mind_reconstruction');
assert.match(dissatisfied.response, /meaningful user outcome|value gap/i);
assert.doesNotMatch(dissatisfied.response, forbidden);

const dream = routeMessage('Are we moving toward the dream?', {}, {});
assert.strictEqual(dream.matchedRoute, 'founder_mind_reconstruction');
assert.match(dream.response, /dream|personal intelligence layer|infrastructure/i);
assert.doesNotMatch(dream.response, forbidden);

const blocked = enforceAntiTemplateOnRoute({
  command: 'agent',
  matchedRoute: 'agent_intent',
  details: { agent: 'cto', intent: 'summary' },
  response: 'CTO: Team is ready.\nHealth 30/100\nMomentum: STALLED\nReview Gate active.'
}, {
  message: 'Bro why am I not satisfied with this feature?',
  state: {}
});
assert.strictEqual(blocked.command, 'anti_template_conversation_guard');
assert.strictEqual(blocked.matchedRoute, 'anti_template_layer');
assert.doesNotMatch(blocked.response, forbidden);
assert.match(blocked.response, /wrong response path|actual concern/i);

const allowedStatus = enforceAntiTemplateOnRoute({
  command: 'status',
  matchedRoute: 'exact_command',
  details: { agent: 'cto', intent: 'status' },
  response: 'Founder, CTO status\nHealth: 80/100\nMomentum: RECOVERING'
}, {
  message: 'status',
  state: {
    metricProvenance: {
      health: { value: '80/100', source: 'ai-cto/.brain_state.json' }
    }
  }
});
assert.strictEqual(allowedStatus.command, 'status');
assert(containsForbiddenTemplate(allowedStatus.response));

console.log('Anti-template layer checks passed.');
