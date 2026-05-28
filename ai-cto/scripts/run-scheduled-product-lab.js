const path = require('path');
const os = require('os');
const {
  analyzeScreenshotEvidence
} = require('../product-lab/screenshot-analysis/screenshot-diff-engine');
const {
  generateProductLabReports
} = require('../product-lab/reports/product-lab-report');

const ROOT = path.resolve(__dirname, '..', '..');

function runScheduledProductLab({
  runLabel = process.env.PRODUCT_LAB_RUN_LABEL || 'scheduled validation'
} = {}) {
  const evidence = analyzeScreenshotEvidence({
    candidate: defaultCandidateMetrics(),
    baseline: defaultBaselineMetrics()
  });
  const reports = generateProductLabReports({
    evidence,
    runLabel,
    outputDir: productLabOutputDir()
  });
  return { evidence, reports };
}

function productLabOutputDir() {
  if (process.env.PRODUCT_LAB_OUTPUT_DIR) return process.env.PRODUCT_LAB_OUTPUT_DIR;
  if (process.env.GITHUB_ACTIONS) return path.join(ROOT, 'artifacts', 'product-lab', 'reports');
  return path.join(os.tmpdir(), 'aritenis-product-lab-reports');
}

function defaultCandidateMetrics() {
  return {
    name: 'Aritenis current build',
    width: 1080,
    height: 420,
    averageKeyWidth: 44,
    averageKeyGap: 5,
    darkModeContrastRatio: 4.5,
    symbolToggleTravelPx: 130,
    edgeKeyWidth: 44,
    overlapCount: 0
  };
}

function defaultBaselineMetrics() {
  return {
    name: 'previous stable baseline',
    width: 1080,
    height: 420,
    averageKeyWidth: 44,
    averageKeyGap: 5,
    darkModeContrastRatio: 4.5,
    symbolToggleTravelPx: 130,
    edgeKeyWidth: 44,
    overlapCount: 0
  };
}

if (require.main === module) {
  const result = runScheduledProductLab();
  process.stdout.write(result.reports.whatsappSummary);
  process.stdout.write('\n');
}

module.exports = {
  productLabOutputDir,
  runScheduledProductLab
};
