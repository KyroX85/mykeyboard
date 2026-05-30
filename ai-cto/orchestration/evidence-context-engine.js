const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const EVIDENCE_FILES = [
  'ai-cto/AGENT_ROADMAP.md',
  'ai-cto/roadmap-lock.json',
  'ai-cto/reports/PRODUCT_LAB_REPORT.md',
  'ai-cto/reports/SCREENSHOT_COMPARISON_REPORT.md',
  'PRODUCT_LAB_REPORT.md',
  'SCREENSHOT_COMPARISON_REPORT.md',
  'UX_REGRESSION_REPORT.md',
  'RETENTION_RISK_REPORT.md',
  'PRODUCT_PRESSURE_REPORT.md',
  'REGRESSION_MEMORY_REPORT.md'
];

function buildEvidenceContext(proposal = '') {
  const lower = String(proposal || '').toLowerCase();
  const seen = [];
  const missing = [];

  for (const relativePath of EVIDENCE_FILES) {
    const absolutePath = path.join(ROOT, relativePath);
    if (fs.existsSync(absolutePath)) {
      const stat = fs.statSync(absolutePath);
      seen.push({
        file: relativePath.replace(/\\/g, '/'),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    }
  }

  if (/\b(screenshot|screen|image|visual|gboard|swiftkey)\b/.test(lower)) {
    requireMissing(missing, seen, 'fresh Product Lab screenshot comparison', [
      'ai-cto/reports/SCREENSHOT_COMPARISON_REPORT.md',
      'SCREENSHOT_COMPARISON_REPORT.md'
    ]);
  }

  if (/\b(prediction|predictor|swipe|typing|latency|layout|sizing|keyboardservice)\b/.test(lower)) {
    requireMissing(missing, seen, 'foundation regression evidence', [
      'UX_REGRESSION_REPORT.md',
      'PRODUCT_PRESSURE_REPORT.md',
      'REGRESSION_MEMORY_REPORT.md'
    ]);
  }

  if (/\b(auto.?send|store|forever|upload|cloud|background)\b/.test(lower)) {
    missing.push('explicit privacy and confirmation safety proof');
  }

  return {
    seen,
    missing: [...new Set(missing)],
    confidence: confidenceFor(seen, missing)
  };
}

function requireMissing(missing, seen, label, acceptedFiles) {
  const hasAccepted = seen.some((item) => acceptedFiles.includes(item.file));
  if (!hasAccepted) missing.push(label);
}

function confidenceFor(seen, missing) {
  if (!seen.length) return 'LOW';
  if (missing.length >= 2) return 'LOW';
  if (missing.length === 1) return 'MEDIUM';
  return 'HIGH';
}

function formatEvidenceContext(evidence) {
  const seen = evidence.seen.length
    ? evidence.seen.slice(0, 5).map((item) => `- ${item.file}`).join('\n')
    : '- No local evidence files found';
  const missing = evidence.missing.length
    ? evidence.missing.map((item) => `- ${item}`).join('\n')
    : '- No blocking evidence gap detected';
  return [
    'Evidence Seen',
    seen,
    'Missing Evidence',
    missing,
    `Evidence Confidence: ${evidence.confidence}`
  ].join('\n');
}

module.exports = {
  buildEvidenceContext,
  formatEvidenceContext
};
