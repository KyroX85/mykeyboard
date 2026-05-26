const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  evaluateRoadmapAlignment,
  detectProductDrift,
  computeAutonomyPosture,
  archiveProductEvidence,
  compareEvidenceTrend,
  createTrustedExperiment,
  expireTrustedExperiments,
  computeProductStabilityIndex,
  founderAbsenceMode,
  recordProductWisdom,
  buildHumanReturnRecovery
} = require('../product-governance');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-stewardship-'));
fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });

process.on('exit', () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const conflict = evaluateRoadmapAlignment({
  root: tempRoot,
  proposal: 'Add cloud AI companion chat before keyboard stabilization'
});
assert.strictEqual(conflict.decision, 'BLOCK');
assert(conflict.conflicts.some((item) => item.includes('Phase 1')));

const aligned = evaluateRoadmapAlignment({
  root: tempRoot,
  proposal: 'Improve spacebar visibility',
  expectedUxGain: 'reduce typing ambiguity and improve touch confidence'
});
assert.strictEqual(aligned.allowed, true);

const drift = detectProductDrift({
  files: ['REPORT_A.md', 'REPORT_B.md', 'memory.json', 'agent-action-log.json'],
  actions: ['architecture expansion without UX gain', 'wrapper proliferation'],
  modules: ['trust-governance.js', 'memory-governance.js', 'policy-governance.js']
});
assert.strictEqual(drift.level, 'HIGH');
assert.strictEqual(drift.autonomyAdjustment, 'REDUCE_TO_PRESERVATION_ONLY');

const decayed = computeAutonomyPosture({
  daysSinceFounderFeedback: 40,
  realDeviceEvidence: false,
  successfulProductValidations: 0,
  stabilityIndex: 55,
  driftScore: 65
});
assert.strictEqual(decayed.level, 'PRESERVATION_ONLY');
assert(decayed.allowed.includes('block drift'));

archiveProductEvidence({
  root: tempRoot,
  source: 'test-previous',
  snapshot: {
    correctionLoad: 30,
    swipeStability: 70,
    symbolFriction: 40,
    modeSwitchFriction: 25,
    responsiveness: 78,
    edgeKeyConfidence: 66,
    rawText: 'must-not-store'
  }
});
const archive = archiveProductEvidence({
  root: tempRoot,
  source: 'test-current',
  snapshot: {
    correctionLoad: 20,
    swipeStability: 82,
    symbolFriction: 35,
    modeSwitchFriction: 20,
    responsiveness: 86,
    edgeKeyConfidence: 72,
    sentence: 'must-not-store'
  }
});
assert.strictEqual(archive.entries.length, 2);
assert(!JSON.stringify(archive).includes('must-not-store'));

const trends = compareEvidenceTrend([
  { metrics: { correctionLoad: 40, swipeStability: 60 } },
  { metrics: { correctionLoad: 20, swipeStability: 80 } }
]);
assert.strictEqual(trends.correctionLoad.direction, 'IMPROVING');
assert.strictEqual(trends.swipeStability.direction, 'IMPROVING');

const incompleteExperiment = createTrustedExperiment({
  title: 'Tune swipe resolver',
  expectedRisk: 'medium',
  rollbackSimplicity: 'simple revert',
  affectedSubsystems: ['swipe']
});
assert.strictEqual(incompleteExperiment.ok, false);

const experiment = createTrustedExperiment({
  title: 'Improve symbol access ordering',
  expectedUxGain: 'reduce symbol hunting',
  expectedRisk: 'low',
  rollbackSimplicity: 'single file revert',
  affectedTrustScores: ['symbol friction'],
  affectedSubsystems: ['symbols'],
  confidenceLevel: 'MEDIUM',
  evidenceSource: 'mode-switch friction trend'
});
assert.strictEqual(experiment.ok, true);

const expired = expireTrustedExperiments([
  {
    ...experiment.experiment,
    validation: { improved: false },
    rollbackCount: 0
  }
], '2026-07-01T00:00:00.000Z');
assert.strictEqual(expired[0].status, 'EXPIRED');

const stability = computeProductStabilityIndex({
  regressions: 2,
  rollbackFrequency: 1,
  correctionLoad: 30,
  swipeInstability: 40,
  runtimeInstability: 15,
  unresolvedFriction: 3,
  fakeProgressRate: 25,
  trustScoreTrend: -10
});
assert(stability.score < 60);
assert.notStrictEqual(stability.autonomyAdjustment, 'NO_INCREASE');

const absence = founderAbsenceMode({
  daysSinceFounderFeedback: 10,
  stabilityIndex: 58,
  driftScore: 35
});
assert.strictEqual(absence.active, true);
assert(absence.blocked.includes('redesign'));

const wisdom = recordProductWisdom({
  root: tempRoot,
  type: 'founder_rejected',
  summary: 'Rejected architecture growth without typing gain.',
  evidence: 'Founder explicitly rejected overengineering.',
  files: ['ai-cto/product-governance.js']
});
assert.strictEqual(wisdom.founder_rejected.length, 1);

const recovery = buildHumanReturnRecovery({
  since: '2026-06-04',
  changes: ['build stabilized', 'symbol friction reduced'],
  blocked: ['cloud AI typing proposal'],
  postponed: ['companion chat'],
  risks: ['swipe unstable on long words'],
  trends: { swipeStability: { direction: 'DEGRADING' } },
  trustScores: { Coder: 68 }
});
assert(recovery.whatChanged.includes('build stabilized'));
assert(recovery.whatWasBlocked.includes('cloud AI typing proposal'));
assert.strictEqual(recovery.style, 'operational truth only');

console.log('Long-horizon product stewardship checks passed.');
