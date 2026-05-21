const assert = require('assert');

const { getPersonality } = require('../whatsapp/personality-router');
const { buildConversationMemory } = require('../whatsapp/conversational-memory');
const { buildNaturalResponse } = require('../whatsapp/natural-response-builder');
const { generatePassiveWorkerUpdates } = require('../whatsapp/humanized-summary-generator');

const sampleState = {
  generatedAt: '2026-05-21T04:00:00.000Z',
  healthScore: 62,
  momentum: 'WATCH',
  validation: [
    { task: ':app:testDebugUnitTest', status: 'passed' },
    { task: ':app:lintDebug', status: 'failed' }
  ],
  sections: {
    risks: ['[HIGH] Regression risk in keyboard cleanup path'],
    unresolved: ['[CRITICAL] Unsafe secret handling still unresolved'],
    repeatedFailures: ['lintDebug failed twice this week'],
    unstableFiles: ['KeyboardService.kt: 3 changes'],
    completedFixes: ['Safe execution dry-run layer added'],
    approvals: ['Review rollback scope before execution'],
    nextPriority: ['Stabilize keyboard cleanup validation'],
    safestOpportunity: ['Compress old CTO reports without touching app logic']
  },
  changed: {
    completed: ['Safe execution dry-run layer added'],
    newRisks: ['[HIGH] Regression risk in keyboard cleanup path'],
    lastTrendAt: '2026-05-21T04:00:00.000Z',
    issueCount: 2
  },
  summary: {
    health: '62/100',
    momentum: 'WATCH',
    topRisk: '[CRITICAL] Unsafe secret handling still unresolved',
    nextPriority: 'Stabilize keyboard cleanup validation',
    lastAnalysis: '2026-05-21T04:00:00.000Z'
  }
};

assert.strictEqual(getPersonality('coder').label, 'Aritenis Coder');
assert.strictEqual(getPersonality('auditor').relationship, 'serious safety worker');

const memory = buildConversationMemory({
  agent: 'coder',
  intent: 'current_work',
  topic: 'keyboard cleanup',
  state: sampleState,
  priorMemory: {
    lastAgentInteraction: 'reviewer',
    lastDiscussedTopic: 'safe execution',
    lastUnfinishedConcern: 'Rollback safety unclear',
    lastActiveTask: 'Old cleanup task'
  }
});

assert.strictEqual(memory.lastAgentInteraction, 'coder');
assert.strictEqual(memory.lastDiscussedTopic, 'keyboard cleanup');
assert.strictEqual(memory.latestUnresolvedIssue, '[CRITICAL] Unsafe secret handling still unresolved');
assert.strictEqual(memory.latestImprovement, 'Safe execution dry-run layer added');
assert.strictEqual(memory.latestWarning, '[HIGH] Regression risk in keyboard cleanup path');

const coderReply = buildNaturalResponse({
  agent: 'coder',
  intent: 'current_work',
  topic: 'keyboard cleanup',
  state: sampleState,
  memory
});

assert(coderReply.includes('[Aritenis Coder]'));
assert(coderReply.includes('Sir'));
assert(coderReply.includes('keyboard cleanup'));
assert(coderReply.includes('Safe execution dry-run layer added'));
assert(coderReply.includes('Attempted:'));
assert(coderReply.includes('Succeeded:'));
assert(coderReply.includes('Failed:'));
assert(coderReply.includes('Blocked:'));
assert(coderReply.includes('Confidence:'));
assert(coderReply.includes('Risk:'));
assert(coderReply.includes('Next:'));
assert(coderReply.includes('REALITY CHECK'));
assert(coderReply.includes('actually improved for user'));
assert(coderReply.includes('measurable signal'));
assert(coderReply.includes('still feels weak'));
assert(coderReply.includes('perceptible'));
assert(!coderReply.includes('I finished keyboard cleanup'));
assert(!coderReply.includes('{'));
assert(coderReply.length < 900);

const auditorReply = buildNaturalResponse({
  agent: 'auditor',
  intent: 'risks',
  state: sampleState,
  memory
});

assert(auditorReply.includes('[Aritenis Auditor]'));
assert(auditorReply.includes('Unsafe secret handling'));
assert(auditorReply.includes('danger'));
assert(auditorReply.includes('Attempted:'));
assert(auditorReply.includes('Risk:'));
assert(!auditorReply.includes('fixed'));
assert(auditorReply.length < 700);

const ctoReply = buildNaturalResponse({
  agent: 'cto',
  intent: 'summary',
  state: sampleState,
  memory
});
assert(ctoReply.includes('REAL PROGRESS SIGNAL'));
assert(ctoReply.includes('build stability'));
assert(ctoReply.includes('typing latency'));
assert(ctoReply.includes('keypress responsiveness'));
assert(ctoReply.includes('unresolved blockers'));
assert(ctoReply.includes('FAKE PROGRESS WATCH'));
assert(ctoReply.includes('agent-system bloat'));

const docOnlyState = {
  ...sampleState,
  validation: [],
  sections: {
    ...sampleState.sections,
    risks: [],
    unresolved: [],
    repeatedFailures: [],
    completedFixes: ['Updated CTO report wording', 'Documentation cleanup pass'],
    nextPriority: ['Validate runtime keyboard behavior']
  },
  changed: {
    ...sampleState.changed,
    completed: ['Updated CTO report wording'],
    newRisks: []
  }
};

const docOnlyReply = buildNaturalResponse({
  agent: 'coder',
  intent: 'current_work',
  state: docOnlyState,
  memory: buildConversationMemory({
    agent: 'coder',
    intent: 'current_work',
    state: docOnlyState,
    priorMemory: {}
  })
});
assert(docOnlyReply.includes('documentation pass only - no runtime improvement'));
assert(docOnlyReply.includes('Sir, no major runtime improvement today'));
assert(docOnlyReply.includes('low operational impact'));
assert(docOnlyReply.includes('perceptible: no'));

const updates = generatePassiveWorkerUpdates(sampleState, {
  execution: {
    completed: [],
    blocked: [{ owning_agent: 'Reviewer', action: 'resource-removal', state: 'BLOCKED', result: 'BLOCKED' }],
    rolledBack: [],
    dryRun: [{ owning_agent: 'Coder', action: 'report-compression', state: 'APPROVED', result: 'DRY_RUN' }]
  }
});

assert(updates.some((line) => line.includes('Coder paused at dry-run')));
assert(updates.some((line) => line.includes('Reviewer blocked')));
assert(updates.every((line) => line.length < 180));

console.log('Human conversational worker layer checks passed.');
