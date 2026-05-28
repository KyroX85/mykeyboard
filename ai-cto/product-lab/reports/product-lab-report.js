const fs = require('fs');
const path = require('path');
const { formatScreenshotComparisonReport } = require('../screenshot-analysis/screenshot-diff-engine');

function generateProductLabReports({
  evidence = {},
  runLabel = 'scheduled validation',
  outputDir = path.join(process.cwd(), 'ai-cto', 'product-lab', 'reports')
} = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const productLab = formatProductLabReport(evidence, runLabel);
  const screenshotComparison = formatScreenshotComparisonReport(evidence);
  const uxRegression = formatUxRegressionReport(evidence);
  const retentionRisk = formatRetentionRiskReport(evidence);
  const whatsappSummary = buildWhatsappSummary(evidence);

  write(path.join(outputDir, 'PRODUCT_LAB_REPORT.md'), productLab);
  write(path.join(outputDir, 'SCREENSHOT_COMPARISON_REPORT.md'), screenshotComparison);
  write(path.join(outputDir, 'UX_REGRESSION_REPORT.md'), uxRegression);
  write(path.join(outputDir, 'RETENTION_RISK_REPORT.md'), retentionRisk);
  write(path.join(outputDir, 'WHATSAPP_SUMMARY.txt'), whatsappSummary);

  return {
    productLab,
    screenshotComparison,
    uxRegression,
    retentionRisk,
    whatsappSummary
  };
}

function formatProductLabReport(evidence, runLabel) {
  return [
    '# PRODUCT_LAB_REPORT',
    '',
    '## WHAT WAS TESTED',
    `- Run: ${runLabel}`,
    '- APK build, emulator install, scripted keyboard flows, screenshots, and measurable UX comparison.',
    '',
    '## WHAT WAS OBSERVED',
    observedLines(evidence),
    '',
    '## WHAT IS MEASURED',
    measuredLines(evidence),
    '',
    '## WHAT IS ONLY THEORETICAL',
    '- Real thumb feel remains inferred until founder or physical-device validation confirms it.',
    '- Mature keyboard comparison depends on available baseline screenshots.',
    '',
    '## REGRESSION RISK',
    '- Lab-only. No product code mutation occurs.',
    '',
    '## RETENTION IMPACT',
    '- Positive if findings are used to choose small Phase 1 experiments instead of architecture churn.',
    '',
    '## SAFE NEXT EXPERIMENT',
    safeNextExperiment(evidence),
    ''
  ].join('\n');
}

function formatUxRegressionReport(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  return [
    '# UX_REGRESSION_REPORT',
    '',
    `Status: ${evidence.status || 'UNKNOWN'}`,
    '',
    findings.length
      ? findings.map((finding) => `- ${finding.severity}: ${finding.type} - ${finding.message}`).join('\n')
      : '- No measurable UX regression detected by current lab heuristics.',
    '',
    'Mutation policy: report only; wait for founder approval.',
    ''
  ].join('\n');
}

function formatRetentionRiskReport(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  const highCount = findings.filter((finding) => finding.severity === 'HIGH').length;
  return [
    '# RETENTION_RISK_REPORT',
    '',
    `Risk level: ${highCount ? 'MEDIUM' : findings.length ? 'LOW-MEDIUM' : 'LOW'}`,
    '',
    '- Retention risk rises when spacing, contrast, symbol access, or edge keys make typing feel heavier.',
    findings.length
      ? findings.map((finding) => `- ${finding.type}: ${finding.message}`).join('\n')
      : '- No current measurable retention pressure from screenshot evidence.',
    '',
    'Approval rule: no implementation without explicit founder approval.',
    ''
  ].join('\n');
}

function buildWhatsappSummary(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  const first = findings[0];
  if (!first) {
    return [
      'Founder,',
      'Scheduled product lab found no measurable UX regression in the current screenshot heuristics.',
      'No fix proposed. Continuing evidence collection.',
      'Awaiting approval only if you want a manual review.'
    ].join('\n');
  }
  return [
    'Founder,',
    `${first.message}`,
    `Measured: ${first.measured}`,
    'Suggested experiment: one small Phase 1 adjustment only after approval.',
    `Regression risk: ${first.severity === 'HIGH' ? 'MEDIUM' : 'LOW'}.`,
    'Awaiting approval.'
  ].join('\n');
}

function observedLines(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  return findings.length
    ? findings.map((finding) => `- ${finding.message}`).join('\n')
    : '- No measured finding crossed current lab thresholds.';
}

function measuredLines(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  return findings.length
    ? findings.map((finding) => `- ${finding.type}: ${finding.measured}`).join('\n')
    : '- Spacing, edge-key, contrast, symbol travel, and overlap checks stayed within thresholds.';
}

function safeNextExperiment(evidence = {}) {
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  if (!findings.length) return '- No experiment. Preserve stability and collect more evidence.';
  const first = findings[0];
  return `- Prepare an approval-gated micro-experiment for ${first.type}; no hot-path mutation.`;
}

function write(file, value) {
  fs.writeFileSync(file, `${value}\n`);
}

module.exports = {
  buildWhatsappSummary,
  generateProductLabReports
};
