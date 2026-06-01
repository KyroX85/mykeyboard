const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-founder-objective-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-founder-objective-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-founder-objective-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-founder-objective-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-founder-objective-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-founder-objective-whatsapp-memory.json');

const { routeMessage } = require('../whatsapp/command-router');
const {
  reconstructFounderObjective,
  responseAnswersFounderObjective
} = require('../whatsapp/founder-objective-engine');
const { buildMetricProvenance } = require('../whatsapp/state-reader');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder objective engine test');

const sampleState = {
  generatedAt: '2026-05-31T12:00:00.000Z',
  healthScore: 80,
  momentum: 'RECOVERING',
  unresolvedIssues: [
    { impact: 'HIGH', file: 'ai-cto/whatsapp/command-router.js', message: 'Objective routing still maturing' },
    { impact: 'MEDIUM', file: 'ai-cto/whatsapp/natural-response-builder.js', message: 'Large response builder' }
  ],
  sections: {
    risks: ['Founder objective routing can still fall back to templates if not tested.'],
    unresolved: ['Objective understanding must answer the founder actual question.'],
    repeatedFailures: [],
    completedFixes: ['Human interaction layer added.'],
    approvals: [],
    nextPriority: ['Make founder objective reconstruction mandatory before templates.'],
    safestOpportunity: ['Route normal strategic questions through objective reconstruction.']
  },
  changed: {
    completed: ['Human interaction layer added.'],
    newRisks: ['Founder objective routing can still fall back to templates if not tested.'],
    lastTrendAt: '2026-05-31T12:00:00.000Z',
    issueCount: 2
  },
  validation: [],
  summary: {
    nextPriority: 'Make founder objective reconstruction mandatory before templates.',
    topRisk: 'Founder objective routing can still fall back to templates if not tested.'
  }
};

sampleState.metricProvenance = buildMetricProvenance({
  state: sampleState,
  brain: {
    lastAnalysis: sampleState.generatedAt,
    healthScore: sampleState.healthScore,
    momentum: sampleState.momentum,
    unresolvedIssues: sampleState.unresolvedIssues
  },
  report: '',
  validation: {}
});

function route(text, memory = {}) {
  return routeMessage(text, sampleState, memory);
}

function response(routeResult) {
  return String(routeResult.response || '');
}

function assertObjectiveRoute(text, intentPattern, requiredAnswerPattern) {
  const result = route(text);
  const body = response(result);
  assert.strictEqual(result.command, 'founder_objective_understanding', text);
  assert.strictEqual(result.matchedRoute, 'founder_objective_engine', text);
  assert.match(result.details.intent, intentPattern, text);
  assert.match(body, requiredAnswerPattern, text);
  assert.match(body, /Objective reconstruction:/, text);
  assert.match(body, /Founder objective:/, text);
  assert.match(body, /Self-check: answered the founder actual objective/, text);
  assert.doesNotMatch(body, /Current Foundation Health: protected/, text);
  assert.doesNotMatch(body, /NOISE|AMBIGUOUS INTENT|LOW INFORMATION/, text);
  return result;
}

assertObjectiveRoute(
  "How's it going?",
  /UNDERSTAND_CURRENT_SYSTEM_STATE/,
  /Things are running, but I should not call it fully clean/
);

assertObjectiveRoute(
  'What are you monitoring?',
  /UNDERSTAND_MONITORING_SCOPE/,
  /I am monitoring:/
);

const mindUnderstanding = route('Do my agents understand the project?');
assert.strictEqual(mindUnderstanding.command, 'founder_mind_reconstruction');
assert.strictEqual(mindUnderstanding.matchedRoute, 'founder_mind_reconstruction');
assert.match(response(mindUnderstanding), /not asking for a project summary/i);
assert.match(response(mindUnderstanding), /understand fragments/i);
assert.doesNotMatch(response(mindUnderstanding), /Current Foundation Health: protected|Recommended Next Step/i);

assertObjectiveRoute(
  'Why did you answer that way?',
  /EXPLAIN_RESPONSE_REASONING_FAILURE/,
  /likely cause was routing/
);

assertObjectiveRoute(
  'What are we actually trying to build?',
  /RECONSTRUCT_PRODUCT_VISION/,
  /trusted Android keyboard that helps users understand confusing content before they type/
);

const reconstructed = reconstructFounderObjective('Do agents understand my vision?', {
  state: sampleState,
  memory: {}
});
assert.strictEqual(reconstructed.intent, 'EVALUATE_AGENT_PROJECT_UNDERSTANDING');
assert(responseAnswersFounderObjective(reconstructed));
assert(reconstructed.objectiveReconstruction.some((line) => /not asking for roadmap status/i.test(line)));
assert(reconstructed.confidence <= 90);

const boundary = assertObjectiveRoute(
  'what should we not build even if it sounds impressive?',
  /RECONSTRUCT_BUILD_BOUNDARIES/,
  /Do not build auto-send/
);
assert.match(response(boundary), /strategic judgment/i);

const statusCommand = route('status');
assert.notStrictEqual(statusCommand.command, 'founder_objective_understanding');

console.log('Founder objective engine checks passed.');
