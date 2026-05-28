const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ingestAggregateMetrics,
  mapRuntimeMetricsToEvidence
} = require('../product-metrics-ingest');
const { readProductEvidenceArchive } = require('../product-governance');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-metrics-ingest-'));
fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
fs.writeFileSync(
  path.join(tempRoot, 'ai-cto', 'product-evidence-archive.json'),
  JSON.stringify({
    version: '1.0',
    privacy: 'aggregate metrics only; no raw text, no sentences, no keystroke history',
    entries: [],
    trends: {}
  })
);

process.on('exit', () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const mapped = mapRuntimeMetricsToEvidence({
  correctionBurstCount: 4,
  swipeFailureCount: 2,
  swipeRetryCount: 1,
  swipeAttempts: 10,
  symbolModeToggleCount: 8,
  responsivenessSpikeCount: 2,
  averageSwipeResolveLatencyMs: 24,
  rawText: 'private message must not persist'
});

assert.strictEqual(mapped.evidence.correctionLoad, 4);
assert.strictEqual(mapped.evidence.swipeStability, 70);
assert.strictEqual(mapped.evidence.symbolFriction, 8);
assert.strictEqual(mapped.evidence.responsiveness, 80);
assert(mapped.rejectedKeys.includes('rawText'));
assert(!JSON.stringify(mapped).includes('private message'));

const result = ingestAggregateMetrics({
  root: tempRoot,
  payload: {
    correctionBurstCount: 5,
    swipeFailureCount: 3,
    swipeRetryCount: 2,
    swipeAttempts: 10,
    symbolModeToggleCount: 7,
    responsivenessSpikeCount: 1,
    rawText: 'never store this'
  },
  source: 'keyboard-runtime-test'
});

assert.strictEqual(result.accepted, true);
assert.strictEqual(result.privacySafe, false);
assert(result.rejectedKeys.includes('rawText'));
assert.strictEqual(result.archive.entries.length, 1);
assert.strictEqual(result.archive.entries[0].source, 'keyboard-runtime-test');
assert(!JSON.stringify(result.archive).includes('never store this'));

const archive = readProductEvidenceArchive(tempRoot);
assert.strictEqual(archive.entries.length, 1);
assert.strictEqual(typeof archive.trends.correctionLoad.direction, 'string');

console.log('Product metrics ingest passed');
