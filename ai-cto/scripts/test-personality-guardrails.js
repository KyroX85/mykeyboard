const assert = require('assert');
const { routeMessage } = require('../whatsapp/command-router');
const {
  enforcePersonalityGuardrails,
  hasForbiddenPersonalityLanguage,
  MAX_RESPONSE_LENGTH
} = require('../whatsapp/personality-guard');

const sampleState = {
  generatedAt: '2026-05-20T05:54:15.010Z',
  healthScore: 25,
  momentum: 'STALLED',
  validation: [],
  sections: {
    risks: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    unresolved: ['[HIGH] ARCHITECTURE: Unsafe Try Block in chaos_test.js'],
    repeatedFailures: [],
    unstableFiles: [],
    completedFixes: ['Report and state generation completed for this run.'],
    approvals: [],
    nextPriority: ['Audit hardcoded secret finding.'],
    safestOpportunity: []
  },
  changed: { completed: [], newRisks: [], lastTrendAt: null, issueCount: 1 },
  summary: {
    health: '25/100',
    momentum: 'STALLED',
    topRisk: '[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js',
    nextPriority: 'Audit hardcoded secret finding.',
    lastAnalysis: '2026-05-20T05:54:15.010Z'
  }
};

const naturalMessages = [
  'cto update me',
  'coder what are you working on',
  'reviewer any risks',
  'auditor dangerous maintenance actions'
];

for (const message of naturalMessages) {
  const response = routeMessage(message, sampleState, {}).response;
  assert(response.length <= MAX_RESPONSE_LENGTH);
  assert.strictEqual(hasForbiddenPersonalityLanguage(response), false);
  assert(response.includes('Sir'));
  assert(/^(🎯 CTO|🔧 CODER|⚖️ REVIEWER|🚨 AUDITOR)/.test(response));
  assert(response.split('\n').length <= 5);
}

const guarded = enforcePersonalityGuardrails('I missed you. I feel proud.');
assert.strictEqual(hasForbiddenPersonalityLanguage(guarded), false);

console.log('Personality guardrail checks passed.');
