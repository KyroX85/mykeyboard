const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-route-confidence-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-route-confidence-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-route-confidence-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-route-confidence-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-route-confidence-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-route-confidence-whatsapp-memory-${Date.now()}.json`);

const {
  calibrateRouteConfidence,
  LOW_CONFIDENCE_THRESHOLD,
  maybeApplyCuriosity
} = require('../route-confidence-calibration');
const { enforceMemoryPolicyOnRoute } = require('../memory-policy-enforcer');
const { routeMessage } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'route confidence calibration test');

const exact = enforceMemoryPolicyOnRoute({
  command: 'build_now',
  matchedRoute: 'exact_command',
  response: 'Build queued.'
}, {
  message: 'build now',
  memory: {}
});
assert.match(exact.response, /Route Confidence: 90%|Route Confidence: 94%/);
assert.match(exact.response, /Route Reason:/);
assert(exact.details.routeConfidence.confidence >= LOW_CONFIDENCE_THRESHOLD);

const fallback = enforceMemoryPolicyOnRoute({
  command: 'conversational_fallback',
  matchedRoute: 'safe_low_confidence_fallback',
  response: 'I need more signal before choosing a route.'
}, {
  message: 'hmm maybe',
  memory: {}
});
assert(fallback.details.routeConfidence.confidence < LOW_CONFIDENCE_THRESHOLD);
assert.match(fallback.response, /Route Confidence: \d+%/);
assert.match(fallback.response, /Route Reason: no specific route matched/i);
assert.match(fallback.response, /Useful follow-up:/);

const explicit = calibrateRouteConfidence({
  command: 'founder_mind_reconstruction',
  details: { confidence: 83, selfCheck: 'answered founder concern' }
});
assert.strictEqual(explicit.confidence, 83);
assert.match(explicit.reason, /answered founder concern/);

const realRoute = routeMessage('do the thing', {}, {});
assert.match(realRoute.response, /Route Confidence: \d+%/);
assert.match(realRoute.response, /Route Reason:/);
assert.match(realRoute.response, /Useful follow-up:|CLARIFICATION_REQUEST/);

const founderRoute = routeMessage('Bro what do you think I am actually chasing?', {}, {});
assert(founderRoute.details.routeConfidence);
assert(founderRoute.details.routeConfidence.confidence <= 100);
assert.match(founderRoute.response, /Route Confidence: \d+%/);
assert.match(founderRoute.response, /Route Reason:/);

const adaptiveCuriosity = maybeApplyCuriosity('Route Confidence: 55%\nRoute Reason: test\nAnswer.', {
  command: 'conversational_fallback',
  details: { category: 'dissatisfaction' }
}, {
  confidence: 55
}, {
  message: "I don't like this feature.",
  memory: {
    adaptiveCuriosityMemory: {
      questionsByDomain: {
        dissatisfaction: [{
          question: 'Is this failing because users would not return to it, or because it feels untrustworthy?',
          score: 12,
          uses: 2
        }]
      },
      recentEvents: []
    }
  }
});
assert.match(adaptiveCuriosity, /users would not return|untrustworthy/i);

console.log('Route confidence calibration checks passed.');
