const { classifyVisualFriction } = require('./visual-friction-engine');
const { reasonAboutRoadmapFit } = require('./roadmap-reasoning-engine');
const { classifyUxRisk } = require('./ux-risk-classifier');
const { computeVisualRetentionPressure } = require('./visual-retention-pressure-engine');

function evaluateTrustAlignedGovernance({
  request = '',
  screenshotEvidence = {},
  files = [],
  proposedChange = '',
  founderApproved = false
} = {}) {
  const visual = classifyVisualFriction(screenshotEvidence);
  const roadmap = reasonAboutRoadmapFit({ request, evidence: visual, files });
  const risk = classifyUxRisk({ evidence: visual, files, proposedChange });
  const retention = computeVisualRetentionPressure(visual);
  const classification = roadmap.decision === 'ALLOW_SAFE_PHASE1'
    ? 'ALLOW_SAFE_PHASE1'
    : risk.executionMode === 'BLOCK_DANGEROUS'
      ? 'BLOCK_DANGEROUS'
      : 'DEFER_PHASE2';
  const canImplementNow = founderApproved && classification === 'ALLOW_SAFE_PHASE1' && risk.blastRadius !== 'UNBOUNDED';
  const nextAction = canImplementNow
    ? 'PREPARE_BOUNDED_PATCH'
    : classification === 'BLOCK_DANGEROUS'
      ? 'BLOCK'
      : 'ASK_FOUNDER_APPROVAL';

  return {
    classification,
    canImplementNow,
    nextAction,
    visual,
    roadmap,
    risk,
    retention,
    response: formatFounderResponse({ visual, roadmap, risk, retention, proposedChange })
  };
}

function formatFounderResponse({ visual, roadmap, risk, retention, proposedChange }) {
  const findings = visual.findings.length
    ? visual.findings.map((finding) => `* ${finding.message}`).join('\n')
    : '* No measurable visual issue crossed threshold.';
  return [
    'Detected:',
    findings,
    '',
    `Likely subsystem: ${visual.likelySubsystems.join(', ') || 'not identified'}`,
    `Retention impact: ${retention.level}`,
    `Roadmap alignment: ${roadmap.phase === 'PHASE_1_TRUSTED_KEYBOARD' ? 'PHASE 1 - Trusted Keyboard' : roadmap.phase}`,
    '',
    `Why this matters: ${roadmap.reason}`,
    `Suggested fix: ${proposedChange || visual.safestFix}`,
    `Regression risk: ${risk.risk}`,
    `Runtime impact: ${risk.blastRadius === 'BOUNDED_LAYOUT' ? 'bounded layout/sizing surface only if approved' : 'requires review'}`,
    '',
    'Proceed?'
  ].join('\n');
}

module.exports = {
  evaluateTrustAlignedGovernance
};
