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
assert(!auditorReply.includes('fixed'));
assert(auditorReply.length < 700);

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
