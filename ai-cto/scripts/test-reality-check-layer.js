const assert = require('assert');
const {
  evaluateFounderFacingProgress,
  formatRealityCheck
} = require('../reality-check-layer');
const { buildRecentProductImprovementAnswer } = require('../whatsapp/recent-product-improvements');
const { generateResponse } = require('../whatsapp/response-generator');

const theatre = evaluateFounderFacingProgress({
  items: [
    'generate architecture summary report',
    'cleanup documentation wording'
  ]
});
assert.strictEqual(theatre.meaningful, false);
assert.strictEqual(theatre.message, 'No meaningful founder-facing progress.');
assert(formatRealityCheck(theatre).includes('No meaningful founder-facing progress.'));

const intelligence = evaluateFounderFacingProgress({
  items: [
    'feat: add founder dream alignment model',
    'fix: block status templates in founder conversations'
  ]
});
assert.strictEqual(intelligence.meaningful, true);
assert.strictEqual(intelligence.checks.intelligence, true);
assert.strictEqual(intelligence.checks.trust, true);
assert(formatRealityCheck(intelligence).includes('Intelligence increased: yes'));

const fakeGit = buildRecentProductImprovementAnswer({
  root: process.cwd(),
  limit: 2,
  readCommits: () => [
    { hash: 'aaa111', subject: 'docs: generate architecture briefing report' },
    { hash: 'bbb222', subject: 'chore: cleanup formatting summary' }
  ]
});
assert(fakeGit.includes('No meaningful founder-facing progress.'));
assert(!fakeGit.includes('Verified product-facing improvements today'));

const meaningfulGit = buildRecentProductImprovementAnswer({
  root: process.cwd(),
  limit: 2,
  readCommits: () => [
    { hash: 'ccc333', subject: 'feat: add founder memory relevance retrieval' },
    { hash: 'ddd444', subject: 'fix: block status templates in founder conversations' }
  ]
});
assert(meaningfulGit.includes('Verified product-facing improvements today'));
assert(meaningfulGit.includes('Reality check:'));

const docsOnlyState = {
  sections: {
    completedFixes: ['Generated architecture report only.'],
    unresolved: [],
    risks: [],
    repeatedFailures: [],
    nextPriority: [],
    safestOpportunity: [],
    approvals: []
  },
  changed: {
    completed: ['Generated architecture report only.'],
    newRisks: [],
    issueCount: 1
  },
  validation: []
};
const latestFixes = generateResponse('latest_fixes', docsOnlyState, {});
assert(latestFixes.includes('No meaningful founder-facing progress.'));

console.log('Reality check layer checks passed.');
