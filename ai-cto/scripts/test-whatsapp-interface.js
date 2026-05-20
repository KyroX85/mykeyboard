const assert = require('assert');
const { resolveCommand, routeMessage, shouldUseGeneralFallback } = require('../whatsapp/command-router');
const { parseNaturalIntent } = require('../whatsapp/natural-intent-parser');
const { twiml, normalizePhone, extractTwilioBody } = require('../whatsapp-server');

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
assert.strictEqual(parseNaturalIntent('cto update me').intent, 'summary');
assert.strictEqual(parseNaturalIntent('what is blocked').intent, 'risks');
assert.strictEqual(shouldUseGeneralFallback('hello'), true);
assert.strictEqual(shouldUseGeneralFallback('whats going on'), true);

const status = routeMessage('status', sampleState).response;
assert(status.includes('Founder Sir'));
assert(status.includes('Health: 25/100'));
assert(status.includes(':app:lintDebug: PASSED'));

const risks = routeMessage('risks', sampleState).response;
assert(risks.includes('Hardcoded Secret'));

const focus = routeMessage('focus chaos', sampleState).response;
assert(focus.includes('focus set: chaos'));

const unknown = routeMessage('open the pod bay doors', sampleState);
assert.strictEqual(unknown.command, 'conversational_fallback');
assert(unknown.response.includes('quick CTO update'));

const hello = routeMessage('hello', sampleState);
assert.strictEqual(hello.command, 'conversational_fallback');
assert(hello.response.includes('Health: 25/100'));

const coder = routeMessage('hey coder what are you doing', sampleState).response;
assert(coder.includes('Coder side update'));
assert(coder.includes('Fake progress'));

const reviewer = routeMessage('reviewer any risks', sampleState).response;
assert(reviewer.includes('Reviewer note'));
assert(reviewer.includes('Regression concerns'));

const auditor = routeMessage('auditor any dangerous issues', sampleState).response;
assert(auditor.includes('Auditor check'));
assert(auditor.includes('Audit findings'));

assert(routeMessage('cto update me', sampleState).response.includes('CTO update'));
assert(routeMessage('reviewer update', sampleState).response.includes('Reviewer note'));
assert(routeMessage('cto active tasks', sampleState).response.includes('Task pipeline'));
assert(routeMessage('coder what are you working on', sampleState).response.includes('Assigned pipeline'));
assert(routeMessage('reviewer blocked items', sampleState).response.includes('Review queue'));
assert(routeMessage('auditor critical risks', sampleState).response.includes('Audit queue'));

const xml = twiml('Founder Sir, 5 < 6 & safe');
assert(xml.includes('&lt;'));
assert(xml.includes('&amp;'));

assert.strictEqual(normalizePhone('whatsapp:+123 456'), '+123456');
assert.deepStrictEqual(extractTwilioBody({ body: undefined }).body, '');
assert.deepStrictEqual(extractTwilioBody({ body: { Body: 'hi', From: 'whatsapp:+1', MessageSid: 'SM1' } }).body, 'hi');

console.log('WhatsApp CTO interface checks passed.');
