const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-human-layer-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-human-layer-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-human-layer-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-human-layer-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-human-layer-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-human-layer-whatsapp-memory.json');

const { routeMessage } = require('../whatsapp/command-router');
const { parseNaturalIntent } = require('../whatsapp/natural-intent-parser');
const { updateMemory, readMemory, writeMemory } = require('../whatsapp/memory-store');
const { buildMetricProvenance } = require('../whatsapp/state-reader');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'human interaction layer test');
writeMemory({
  version: '1.0',
  recentMessages: [],
  pendingAction: null
});

const sampleState = {
  generatedAt: '2026-05-31T10:00:00.000Z',
  healthScore: 30,
  momentum: 'STALLED',
  unresolvedIssues: Array.from({ length: 14 }, (_, index) => ({
    impact: 'MEDIUM',
    file: index === 0 ? 'ai-cto/whatsapp/natural-response-builder.js' : `ai-cto/test-${index}.js`,
    message: index === 0 ? 'File too large' : `Medium routing finding ${index}`
  })),
  sections: {
    risks: ['Routing still overfires command mode during normal chat.'],
    unresolved: ['File natural-response-builder.js is too large (>500 lines).'],
    repeatedFailures: [],
    completedFixes: ['Founder memory layer added.'],
    approvals: [],
    nextPriority: ['Reduce false command parsing for normal founder conversation.'],
    safestOpportunity: ['Keep status answers conversational and provenance-backed.']
  },
  changed: {
    completed: ['Founder memory layer added.'],
    newRisks: ['Routing still overfires command mode during normal chat.'],
    lastTrendAt: '2026-05-31T10:00:00.000Z',
    issueCount: 2
  },
  validation: [],
  summary: {
    nextPriority: 'Reduce false command parsing for normal founder conversation.',
    topRisk: 'Routing still overfires command mode during normal chat.'
  }
};

sampleState.metricProvenance = buildMetricProvenance({
  brain: {
    lastAnalysis: sampleState.generatedAt,
    healthScore: sampleState.healthScore,
    momentum: sampleState.momentum,
    unresolvedIssues: sampleState.unresolvedIssues
  },
  state: sampleState,
  report: '',
  validation: {}
});

function body(route) {
  return String(route.response || '');
}

const status = routeMessage('ok hows going on', sampleState, {});
assert.strictEqual(status.matchedRoute, 'human_interaction_layer');
assert.match(body(status), /Things are running/i);
assert.match(body(status), /Health: 30\/100/);
assert.match(body(status), /Source: ai-cto\/\.brain_state\.json/);
assert.match(body(status), /Reason:/);
assert.match(body(status), /Calculation: 100 - \(0\*25 \+ 0\*15 \+ 14\*5 \+ 0\*2\) = 30\./);
assert.doesNotMatch(body(status), /NOISE|AMBIGUOUS|type:/);

const monitoring = routeMessage('what are u monitoring', sampleState, {});
assert.strictEqual(monitoring.matchedRoute, 'human_interaction_layer');
assert.match(body(monitoring), /brain scan freshness/i);
assert.match(body(monitoring), /WhatsApp routing/i);
assert.match(body(monitoring), /Source:/);

const currentWork = routeMessage('what are you working on', sampleState, {});
assert.strictEqual(currentWork.matchedRoute, 'human_interaction_layer');
assert.match(body(currentWork), /I will not claim active coding unless an execution actually started/i);

const bareFix = routeMessage('fix', sampleState, {
  pendingAction: 'Reduce false command parsing for normal founder conversation.'
});
assert.strictEqual(bareFix.matchedRoute, 'human_interaction_layer');
assert.match(body(bareFix), /pending fix target/i);
assert.match(body(bareFix), /No execution started/i);
assert.doesNotMatch(body(bareFix), /What would you like me to fix/i);

const unknownState = {
  sections: { risks: [], unresolved: [], nextPriority: [], safestOpportunity: [], approvals: [] },
  changed: {},
  metricProvenance: buildMetricProvenance({ state: {}, brain: {}, report: '', validation: {} })
};
const unknown = routeMessage('how are things going', unknownState, {});
assert.match(body(unknown), /Health: unknown/);
assert.match(body(unknown), /Source: unknown/);
assert.match(body(unknown), /Calculation: unknown/);

assert.strictEqual(parseNaturalIntent('hows it going').intent, 'status_question');
assert.strictEqual(parseNaturalIntent('how is it going').intent, 'status_question');

updateMemory('human_status_check', sampleState, {
  founderMessage: 'ok hows going on',
  agentAnswer: body(status),
  pendingAction: 'Reduce false command parsing for normal founder conversation.',
  topic: 'status'
});
const memory = readMemory();
assert.strictEqual(memory.previousFounderQuestion, 'ok hows going on');
assert.match(memory.previousAgentAnswer, /Things are running/i);
assert.strictEqual(memory.pendingAction, 'Reduce false command parsing for normal founder conversation.');

console.log('Human interaction layer tests passed.');
