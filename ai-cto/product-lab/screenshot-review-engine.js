const { classifyVisualFriction } = require('./visual-friction-engine');
const { reasonAboutRoadmapFit } = require('./roadmap-reasoning-engine');
const { classifyUxRisk } = require('./ux-risk-classifier');
const { computeVisualRetentionPressure } = require('./visual-retention-pressure-engine');

function reviewScreenshotForProductJudgment({ request = '', screenshotEvidence = {}, files = [] } = {}) {
  const visual = classifyVisualFriction(screenshotEvidence);
  const roadmap = reasonAboutRoadmapFit({ request, evidence: visual, files });
  const risk = classifyUxRisk({ evidence: visual, files, proposedChange: visual.safestFix });
  const retention = computeVisualRetentionPressure(visual);
  return {
    visual,
    roadmap,
    risk,
    retention,
    report: formatReviewReport({ visual, roadmap, risk, retention })
  };
}

function formatReviewReport({ visual, roadmap, risk, retention }) {
  return [
    '# SCREENSHOT_PRODUCT_JUDGMENT_REPORT',
    '',
    '## WHAT IS VISUALLY VERIFIED',
    visual.findings.length
      ? visual.findings.map((finding) => `- ${finding.type}: ${finding.measured}`).join('\n')
      : '- No measurable visual issue crossed current thresholds.',
    '',
    '## WHY IT MATTERS',
    `- ${roadmap.reason}`,
    '',
    '## RETENTION IMPACT',
    `- ${retention.level}: ${retention.drivers.join(', ') || 'no major visual driver'}`,
    '',
    '## ROADMAP ALIGNMENT',
    `- ${roadmap.phase}`,
    '',
    '## REGRESSION RISK',
    `- ${risk.risk}; blast radius ${risk.blastRadius}`,
    '',
    '## WHY THIS IS SAFER THAN ALTERNATIVES',
    '- Bounded visual/sizing proposal beats architecture churn because it targets observed typing friction.',
    '',
    '## WHAT REMAINS THEORETICAL',
    '- Human thumb feel still needs founder or physical-device confirmation.',
    '- Proposed fixes remain blocked until explicit founder approval.',
    ''
  ].join('\n');
}

module.exports = {
  reviewScreenshotForProductJudgment
};
