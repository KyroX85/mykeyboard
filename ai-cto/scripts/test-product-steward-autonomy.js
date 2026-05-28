const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  HOT_PATHS,
  collectEvidence,
  buildRecommendation,
  runProductStewardAutonomy
} = require('./product-steward-autonomy');
const { routeMessage } = require('../whatsapp/command-router');

const root = path.resolve(__dirname, '..', '..');

const evidence = collectEvidence(root);
assert(evidence.phase.includes('Phase 1') || evidence.phase.includes('Stabilization'));
assert(evidence.guardrailTestCount > 0);
for (const hotPath of HOT_PATHS) {
  assert(evidence.hotPathFilesPresent.includes(hotPath), `missing hot path evidence: ${hotPath}`);
}

const recommendation = buildRecommendation(evidence);
assert(recommendation.topPriority);
assert(recommendation.safeAction);
assert(recommendation.blockedActions.some((action) => /hot-path|KeyboardService|SwipeGestureTracker|SwipeWordResolver|BasicPredictor/i.test(action)));

const dryRun = runProductStewardAutonomy({ root, writeReport: false });
assert(dryRun.report.includes('PRODUCT_STEWARD_AUTONOMY_REPORT'));
assert(dryRun.report.includes('Do Not Automate Yet'));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-steward-'));
try {
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'app', 'src', 'main', 'java', 'com', 'example', 'mykeyboard', 'swipe'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'app', 'src', 'main', 'java', 'com', 'example', 'mykeyboard', 'predictor'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'app', 'src', 'test', 'java'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'roadmap-lock.json'), JSON.stringify({ currentPhase: 'Phase 1 - Stabilization' }));
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'product-evidence-archive.json'), JSON.stringify({ entries: [], trends: {} }));
  fs.writeFileSync(path.join(tempRoot, 'PRODUCT_PRESSURE_REPORT.md'), [
    '1. Highest current pressure: swipe trust and correction burden.',
    '2. Most dangerous subsystem: swipe reliability path.',
    '3. Biggest retention risk: silent confidence erosion from correction bursts.',
    '6. Changes to freeze: high-risk hot-path rewrites without evidence.',
    '10. Currently unsafe proposals: architecture rewrites, speculative AI upgrades.'
  ].join('\n'));
  fs.writeFileSync(path.join(tempRoot, 'app', 'src', 'test', 'java', 'SwipeGuardrailsTest.kt'), 'class SwipeGuardrailsTest');
  for (const hotPath of HOT_PATHS) {
    fs.mkdirSync(path.dirname(path.join(tempRoot, hotPath)), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, hotPath), '// protected\n');
  }
  const result = runProductStewardAutonomy({ root: tempRoot });
  assert.strictEqual(result.reportWritten, true);
  assert(fs.existsSync(path.join(tempRoot, 'PRODUCT_STEWARD_AUTONOMY_REPORT.md')));
  assert(result.report.includes('Aggregate product evidence entries: 0'));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const response = routeMessage('research repo and suggest what to improve according to roadmap', {
  healthScore: 80,
  momentum: 'MOVING',
  sections: { risks: [], unresolved: [], approvals: [] },
  summary: { topRisk: 'none' }
}, {});
assert.strictEqual(response.command, 'product_steward_repo_research');
assert(response.response.includes('Top priority:'));
assert(response.response.includes('PRODUCT_STEWARD_AUTONOMY_REPORT.md'));

console.log('Product steward autonomy checks passed.');
