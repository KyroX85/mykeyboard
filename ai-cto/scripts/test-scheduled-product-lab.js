const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const {
  analyzeScreenshotEvidence,
  formatScreenshotComparisonReport
} = require('../product-lab/screenshot-analysis/screenshot-diff-engine');
const {
  buildApprovalPackage,
  isImplementationAllowed
} = require('../product-lab/approval-gate/approval-gate');
const {
  generateProductLabReports,
  buildWhatsappSummary
} = require('../product-lab/reports/product-lab-report');

const requiredFiles = [
  'ai-cto/product-lab/maestro/keyboard-open.yaml',
  'ai-cto/product-lab/maestro/normal-typing.yaml',
  'ai-cto/product-lab/maestro/swipe-typing.yaml',
  'ai-cto/product-lab/maestro/symbol-typing.yaml',
  'ai-cto/product-lab/maestro/dark-mode.yaml',
  'ai-cto/product-lab/maestro/responsiveness.yaml',
  'ai-cto/product-lab/maestro/long-session.yaml',
  'ai-cto/product-lab/adb/install-latest-apk.ps1',
  'ai-cto/product-lab/adb/capture-screenshots.ps1',
  'ai-cto/product-lab/adb/run-ux-session.ps1',
  'ai-cto/product-lab/github-actions/product-lab-validation.yml',
  '.github/workflows/product-lab-validation.yml'
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(ROOT, file)), `Missing ${file}`);
}

const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/product-lab-validation.yml'), 'utf8');
assert(workflow.includes('cron:'));
assert(workflow.includes('30 2 * * *'));
assert(workflow.includes('30 8 * * *'));
assert(workflow.includes('30 15 * * *'));
assert(workflow.includes('reactivecircus/android-emulator-runner'));
assert(workflow.includes('upload-artifact'));
assert(!workflow.includes('git commit'));
assert(!workflow.includes('git push'));

const maestroFlow = fs.readFileSync(path.join(ROOT, 'ai-cto/product-lab/maestro/normal-typing.yaml'), 'utf8');
assert(maestroFlow.includes('scripted test phrase'));
assert(!/password|private|personal/i.test(maestroFlow));

const evidence = analyzeScreenshotEvidence({
  candidate: {
    name: 'Aritenis',
    width: 1080,
    height: 420,
    averageKeyWidth: 39,
    averageKeyGap: 3,
    darkModeContrastRatio: 3.8,
    symbolToggleTravelPx: 190,
    edgeKeyWidth: 37,
    overlapCount: 1
  },
  baseline: {
    name: 'Gboard baseline',
    width: 1080,
    height: 430,
    averageKeyWidth: 44,
    averageKeyGap: 6,
    darkModeContrastRatio: 4.8,
    symbolToggleTravelPx: 120,
    edgeKeyWidth: 44,
    overlapCount: 0
  }
});

assert.strictEqual(evidence.privacy.rawTypingStored, false);
assert(evidence.findings.some((finding) => finding.type === 'cramped-spacing'));
assert(evidence.findings.some((finding) => finding.type === 'dark-mode-contrast'));
assert(evidence.findings.some((finding) => finding.type === 'symbol-friction'));
assert(evidence.findings.some((finding) => finding.type === 'overlap-risk'));
assert(!JSON.stringify(evidence).includes('architecture modernization'));

const screenshotReport = formatScreenshotComparisonReport(evidence);
assert(screenshotReport.includes('SCREENSHOT_COMPARISON_REPORT'));
assert(screenshotReport.includes('WHAT IS MEASURED'));
assert(screenshotReport.includes('WHAT IS ONLY THEORETICAL'));

const approval = buildApprovalPackage({
  proposedChange: 'Relax one symbol key spacing value',
  evidenceSummary: 'Symbol travel exceeded baseline by 70px',
  retentionImpact: 'May reduce symbol hunting fatigue',
  trustImpact: 'Keeps typing calmer',
  regressionRisk: 'LOW',
  runtimeImpact: 'Layout-only if approved'
});
assert.strictEqual(approval.requiresFounderApproval, true);
assert.strictEqual(isImplementationAllowed(approval, { founderApproved: false }), false);
assert.strictEqual(isImplementationAllowed(approval, { founderApproved: true }), true);

const reports = generateProductLabReports({
  evidence,
  runLabel: 'morning validation',
  outputDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-product-lab-reports-'))
});
assert(reports.productLab.includes('WHAT WAS TESTED'));
assert(reports.productLab.includes('SAFE NEXT EXPERIMENT'));
assert(reports.uxRegression.includes('UX_REGRESSION_REPORT'));
assert(reports.retentionRisk.includes('RETENTION_RISK_REPORT'));
assert(reports.whatsappSummary.includes('Founder,'));
assert(reports.whatsappSummary.includes('Awaiting approval'));

const whatsapp = buildWhatsappSummary(evidence);
assert(whatsapp.length < 800);
assert(!/AGI|self-aware|autonomous rewrite/i.test(whatsapp));

console.log('Scheduled product lab checks passed');
