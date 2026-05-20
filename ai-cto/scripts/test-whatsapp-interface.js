const assert = require('assert');
const { resolveCommand, routeMessage } = require('../whatsapp/command-router');
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
  }
};

assert.strictEqual(resolveCommand('status'), 'status');
assert.strictEqual(resolveCommand('what are the risks?'), 'risks');
assert.strictEqual(resolveCommand('latest fixes'), 'latest_fixes');
assert.strictEqual(resolveCommand('weekly summary'), 'weekly_summary');
assert.strictEqual(resolveCommand('unknown command'), 'help');

const status = routeMessage('status', sampleState).response;
assert(status.includes('Founder Sir'));
assert(status.includes('Health: 25/100'));
assert(status.includes(':app:lintDebug: PASSED'));

const risks = routeMessage('risks', sampleState).response;
assert(risks.includes('Hardcoded Secret'));

const xml = twiml('Founder Sir, 5 < 6 & safe');
assert(xml.includes('&lt;'));
assert(xml.includes('&amp;'));

assert.strictEqual(normalizePhone('whatsapp:+123 456'), '+123456');

console.log('WhatsApp CTO interface checks passed.');
