const assert = require('assert');

const { reviewScreenshotForProductJudgment } = require('../product-lab/screenshot-review-engine');
const { classifyVisualFriction } = require('../product-lab/visual-friction-engine');
const { reasonAboutRoadmapFit } = require('../product-lab/roadmap-reasoning-engine');
const { classifyUxRisk } = require('../product-lab/ux-risk-classifier');
const { computeVisualRetentionPressure } = require('../product-lab/visual-retention-pressure-engine');
const { validateAdaptiveSizing } = require('../product-lab/adaptive-sizing-validation');
const { evaluateTrustAlignedGovernance } = require('../product-lab/trust-aligned-governance');

const screenshotEvidence = {
  source: 'founder screenshot',
  candidate: {
    name: 'Aritenis small phone',
    width: 720,
    height: 360,
    averageKeyWidth: 37,
    averageKeyGap: 2,
    darkModeContrastRatio: 4.2,
    symbolToggleTravelPx: 184,
    edgeKeyWidth: 35,
    overlapCount: 1
  },
  baseline: {
    name: 'Gboard small phone baseline',
    width: 720,
    height: 370,
    averageKeyWidth: 44,
    averageKeyGap: 6,
    darkModeContrastRatio: 4.8,
    symbolToggleTravelPx: 118,
    edgeKeyWidth: 44,
    overlapCount: 0
  }
};

const visual = classifyVisualFriction(screenshotEvidence);
assert(visual.findings.some((finding) => finding.type === 'cramped-spacing'));
assert(visual.findings.some((finding) => finding.type === 'edge-key-risk'));
assert(visual.likelySubsystems.includes('KeyboardSizingProfile.kt'));
assert(visual.likelySubsystems.includes('KeyboardSymbols.kt'));
assert(!JSON.stringify(visual).includes('raw text'));

const roadmap = reasonAboutRoadmapFit({
  request: 'adaptive keyboard sizing is broken on smaller phones',
  evidence: visual,
  files: [
    'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt',
    'app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt'
  ]
});
assert.strictEqual(roadmap.phase, 'PHASE_1_TRUSTED_KEYBOARD');
assert.strictEqual(roadmap.aligned, true);
assert.strictEqual(roadmap.decision, 'ALLOW_SAFE_PHASE1');
assert(roadmap.reason.includes('typing trust'));

const risk = classifyUxRisk({
  evidence: visual,
  files: [
    'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt',
    'app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt'
  ],
  proposedChange: '+3dp edge padding and bounded symbol spacing adjustment'
});
assert.strictEqual(risk.blastRadius, 'BOUNDED_LAYOUT');
assert.strictEqual(risk.requiresFounderApproval, true);
assert.strictEqual(risk.executionMode, 'SANDBOX_EXPERIMENT');

const pressure = computeVisualRetentionPressure(visual);
assert(['MEDIUM', 'MEDIUM-HIGH', 'HIGH'].includes(pressure.level));
assert(pressure.drivers.includes('thumb confidence'));

const sizing = validateAdaptiveSizing({
  widthBuckets: [
    { name: 'small', widthPx: 720, averageKeyWidth: 37, edgePaddingDp: 2 },
    { name: 'baseline', widthPx: 1080, averageKeyWidth: 44, edgePaddingDp: 6 }
  ]
});
assert.strictEqual(sizing.status, 'ATTENTION_NEEDED');
assert(sizing.findings.some((finding) => finding.bucket === 'small'));

const governance = evaluateTrustAlignedGovernance({
  request: 'adaptive keyboard sizing is broken on smaller phones',
  screenshotEvidence,
  files: [
    'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt',
    'app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt'
  ],
  proposedChange: '+3dp edge padding and bounded symbol spacing adjustment',
  founderApproved: false
});
assert.strictEqual(governance.classification, 'ALLOW_SAFE_PHASE1');
assert.strictEqual(governance.canImplementNow, false);
assert.strictEqual(governance.nextAction, 'ASK_FOUNDER_APPROVAL');
assert(governance.response.includes('Roadmap alignment: PHASE 1'));
assert(governance.response.includes('Likely subsystem:'));
assert(governance.response.includes('Proceed?'));
assert(!governance.response.includes('move to Phase 2'));

const approved = evaluateTrustAlignedGovernance({
  request: 'adaptive keyboard sizing is broken on smaller phones',
  screenshotEvidence,
  files: [
    'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt'
  ],
  proposedChange: '+3dp edge padding',
  founderApproved: true
});
assert.strictEqual(approved.canImplementNow, true);
assert.strictEqual(approved.nextAction, 'PREPARE_BOUNDED_PATCH');

const review = reviewScreenshotForProductJudgment({
  request: 'symbols feel cramped on this screenshot',
  screenshotEvidence
});
assert(review.report.includes('WHAT IS VISUALLY VERIFIED'));
assert(review.report.includes('WHAT REMAINS THEORETICAL'));
assert(review.report.includes('RETENTION IMPACT'));

console.log('Screenshot product judgment checks passed');
