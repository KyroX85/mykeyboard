const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  beginExecutionCheckpoint,
  completeExecutionCheckpoint,
  recoverInterruptedExecution,
  cleanupStaleLocks,
  restoreCheckpoint
} = require('./execution-checkpoint-system');
const {
  readActionJournal,
  recordJournalEvent,
  repeatedFailureSummary,
  shouldEnterSafeFailureMode
} = require('./action-journal-engine');
const {
  readBrainStateStrict,
  writeBrainStateSafe,
  recoverBrainState
} = require('./state-integrity');
const {
  stewardshipPosture
} = require('./stewardship-timer');
const {
  evaluateExecutionSanity,
  enforcePreservationOnly
} = require('./execution-sanity-filter');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-reliability-'));
fs.mkdirSync(path.join(root, 'ai-cto'), { recursive: true });

process.on('exit', () => {
  fs.rmSync(root, { recursive: true, force: true });
});

fs.writeFileSync(path.join(root, 'README.md'), 'before\n');
const checkpoint = beginExecutionCheckpoint(root, {
  executionId: 'exec-1',
  files: ['README.md'],
  action: 'normalize README'
});
assert.strictEqual(checkpoint.status, 'IN_PROGRESS');
assert(fs.existsSync(path.join(root, 'ai-cto', 'execution-lock.json')));

fs.writeFileSync(path.join(root, 'README.md'), 'after\n');
const recovered = recoverInterruptedExecution(root, { now: new Date(Date.now() + 20 * 60 * 1000) });
assert.strictEqual(recovered.recovered.length, 1);
assert.strictEqual(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), 'before\n');

const stale = cleanupStaleLocks(root, { maxAgeMs: 1, now: new Date(Date.now() + 20 * 60 * 1000) });
assert.strictEqual(stale.cleaned >= 0, true);

const checkpoint2 = beginExecutionCheckpoint(root, {
  executionId: 'exec-2',
  files: ['README.md'],
  action: 'second run'
});
assert.throws(() => beginExecutionCheckpoint(root, {
  executionId: 'exec-2',
  files: ['README.md'],
  action: 'duplicate'
}), /Duplicate execution/);
fs.writeFileSync(path.join(root, 'README.md'), 'changed\n');
restoreCheckpoint(root, checkpoint2.id);
assert.strictEqual(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), 'before\n');
completeExecutionCheckpoint(root, checkpoint2.id, { validation: 'passed' });

recordJournalEvent(root, {
  executionId: 'exec-3',
  action: 'validation failed',
  status: 'ROLLED_BACK',
  validationResult: 'FAILED',
  rollbackReason: 'test failure',
  durationMs: 1200
});
recordJournalEvent(root, {
  executionId: 'exec-4',
  action: 'validation failed again',
  status: 'ROLLED_BACK',
  validationResult: 'FAILED',
  rollbackReason: 'test failure',
  durationMs: 900
});
recordJournalEvent(root, {
  executionId: 'exec-5',
  action: 'blocked unsafe change',
  status: 'BLOCKED',
  validationResult: 'NOT_RUN',
  durationMs: 10
});
const journal = readActionJournal(root);
assert.strictEqual(journal.events.length, 3);
assert.strictEqual(repeatedFailureSummary(root).rollbackCount >= 2, true);
assert.strictEqual(shouldEnterSafeFailureMode(root, {
  trustScore: 55,
  daysSinceFounderPresence: 20,
  stateIntegrityOk: true,
  checkpointsOk: true
}).mode, 'PRESERVATION_ONLY');

writeBrainStateSafe(root, {
  healthScore: 72,
  momentum: 'MOVING',
  unresolvedIssues: []
});
const strictState = readBrainStateStrict(root);
assert.strictEqual(strictState.ok, true);
fs.writeFileSync(path.join(root, 'ai-cto', '.brain_state.json'), '{"healthScore":');
const corruptState = readBrainStateStrict(root);
assert.strictEqual(corruptState.ok, false);
const restored = recoverBrainState(root);
assert.strictEqual(restored.recovered, true);
assert.strictEqual(readBrainStateStrict(root).ok, true);

const guarded = stewardshipPosture({
  lastFounderInteractionAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  now: new Date().toISOString()
});
assert.strictEqual(guarded.mode, 'GUARDED');
const preservation = stewardshipPosture({
  lastFounderInteractionAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  now: new Date().toISOString()
});
assert.strictEqual(preservation.mode, 'PRESERVATION_ONLY');

const sane = evaluateExecutionSanity({
  files: ['README.md'],
  linesChanged: 2,
  task: 'documentation cleanup'
});
assert.strictEqual(sane.allowed, true);
const unsafe = evaluateExecutionSanity({
  files: ['app/src/main/java/com/example/mykeyboard/KeyboardService.kt', 'new-wrapper.js'],
  linesChanged: 300,
  task: 'modernize architecture with smart wrapper'
});
assert.strictEqual(unsafe.allowed, false);
assert(unsafe.reasons.some((reason) => /giant diff|architecture|wrapper/i.test(reason)));
assert.strictEqual(enforcePreservationOnly({ mode: 'PRESERVATION_ONLY' }, 'commit').allowed, false);
assert.strictEqual(enforcePreservationOnly({ mode: 'PRESERVATION_ONLY' }, 'analysis').allowed, true);

console.log('Execution reliability stewardship checks passed.');
