const assert = require('assert');
const { resolveCommand, routeMessage } = require('../whatsapp/command-router');
const { parseNaturalIntent } = require('../whatsapp/natural-intent-parser');
const { twiml, normalizePhone } = require('../whatsapp-server');

const sampleState = {
  generatedAt: '2026-05-20T05:54:15.010Z',
  healthScore: 25,
  momentum: 'STALLED',
  validation: [
    { task: ':app:testDebugUnitTest', status: 'passed' },
    { task: ':app:assembleDebug', status: 'passed' },
    { task: ':app:lintDebug', status: 'passed' }
  ],
  sections: {
    risks: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    unresolved: ['[HIGH] ARCHITECTURE: Unsafe Try Block in chaos_test.js'],
    repeatedFailures: ['No recurring failure pattern detected yet.'],
    unstableFiles: ['chaos_test.js: 2 appearances in 30-day trend'],
    completedFixes: ['Report and state generation completed for this run.'],
    approvals: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    nextPriority: ['Audit and remove Hardcoded Secret in BasicPredictor.kt.'],
    safestOpportunity: ['Plan a small review-only refactor for KeyboardService.kt.']
  },
  changed: {
    completed: ['Report and state generation completed for this run.'],
    newRisks: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    lastTrendAt: '2026-05-20T05:54:15.010Z',
    issueCount: 5
  },
  summary: {
    health: '25/100',
    momentum: 'STALLED',
    topRisk: '[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js',
    nextPriority: 'Audit and remove Hardcoded Secret in BasicPredictor.kt.',
    lastAnalysis: '2026-05-20T05:54:15.010Z'
  }
};

assert.strictEqual(resolveCommand('status'), 'status');
assert.strictEqual(resolveCommand('what are the risks?'), 'risks');
assert.strictEqual(resolveCommand('latest risks'), 'risks');
assert.strictEqual(resolveCommand('latest fixes'), 'latest_fixes');
assert.strictEqual(resolveCommand('weekly summary'), 'weekly_summary');
assert.strictEqual(resolveCommand('what changed'), 'what_changed');
assert.strictEqual(resolveCommand('keyboard health'), 'keyboard_health');
assert.deepStrictEqual(resolveCommand('focus predictor'), { command: 'focus', focusTopic: 'predictor' });
assert.strictEqual(resolveCommand('unknown command'), 'unknown');
assert.deepStrictEqual(parseNaturalIntent('hey coder what are you doing').agent, 'coder');
assert.deepStrictEqual(parseNaturalIntent('reviewer any risks').agent, 'reviewer');
assert.deepStrictEqual(parseNaturalIntent('auditor any dangerous issues').intent, 'risks');

const status = routeMessage('status', sampleState).response;
assert(status.includes('Founder Sir'));
assert(status.includes('Health: 25/100'));
assert(status.includes(':app:lintDebug: PASSED'));

const risks = routeMessage('risks', sampleState).response;
assert(risks.includes('Hardcoded Secret'));

const focus = routeMessage('focus chaos', sampleState).response;
assert(focus.includes('focus set: chaos'));

const unknown = routeMessage('open the pod bay doors', sampleState).response;
assert(unknown.includes('did not recognize'));

const coder = routeMessage('hey coder what are you doing', sampleState).response;
assert(coder.includes('Coder side update'));
assert(coder.includes('Fake progress'));

const reviewer = routeMessage('reviewer any risks', sampleState).response;
assert(reviewer.includes('Reviewer note'));
assert(reviewer.includes('Regression concerns'));

const auditor = routeMessage('auditor any dangerous issues', sampleState).response;
assert(auditor.includes('Auditor check'));
assert(auditor.includes('Audit findings'));

const xml = twiml('Founder Sir, 5 < 6 & safe');
assert(xml.includes('&lt;'));
assert(xml.includes('&amp;'));

assert.strictEqual(normalizePhone('whatsapp:+123 456'), '+123456');

console.log('WhatsApp CTO interface checks passed.');
