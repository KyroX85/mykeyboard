const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_FILE = path.join(ROOT, 'PRODUCT_STEWARD_AUTONOMY_REPORT.md');

const HOT_PATHS = [
  'app/src/main/java/com/example/mykeyboard/KeyboardService.kt',
  'app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt',
  'app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt',
  'app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt'
];

function runProductStewardAutonomy(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const evidence = collectEvidence(root);
  const recommendation = buildRecommendation(evidence);
  const report = formatReport(evidence, recommendation);
  let reportWritten = false;
  if (options.writeReport !== false) {
    try {
      fs.writeFileSync(path.join(root, 'PRODUCT_STEWARD_AUTONOMY_REPORT.md'), report);
      reportWritten = true;
    } catch {
      reportWritten = false;
    }
  }
  return { evidence, recommendation, report, reportWritten };
}

function collectEvidence(root = ROOT) {
  const roadmapLock = readJson(path.join(root, 'ai-cto', 'roadmap-lock.json'), {});
  const evidenceArchive = readJson(path.join(root, 'ai-cto', 'product-evidence-archive.json'), { entries: [], trends: {} });
  const governanceState = readJson(path.join(root, 'ai-cto', 'governance-state.json'), {});
  const pressureReport = readText(path.join(root, 'PRODUCT_PRESSURE_REPORT.md'));
  const maturityReport = readText(path.join(root, 'PRODUCT_MATURITY_REPORT.md'));
  const testFiles = listFiles(path.join(root, 'app', 'src', 'test'), '.kt');
  const sourceFiles = listFiles(path.join(root, 'app', 'src', 'main'), '.kt');
  const guardrailTests = testFiles.filter((file) => /guardrail|hardening|rhythm|replay|metrics|swipe|predictor/i.test(file));

  return {
    phase: roadmapLock.currentPhase || 'unknown',
    productPhilosophy: roadmapLock.productPhilosophy || [],
    pressure: {
      highest: extractReportValue(pressureReport, 'Highest current pressure'),
      dangerousSubsystem: extractReportValue(pressureReport, 'Most dangerous subsystem'),
      retentionRisk: extractReportValue(pressureReport, 'Biggest retention risk'),
      freeze: extractReportValue(pressureReport, 'Changes to freeze'),
      safeImprovements: extractReportValue(pressureReport, 'Safest improvements'),
      unsafeProposals: extractReportValue(pressureReport, 'Currently unsafe proposals')
    },
    aggregateEvidenceEntries: Array.isArray(evidenceArchive.entries) ? evidenceArchive.entries.length : 0,
    aggregateTrends: evidenceArchive.trends || {},
    governanceMode: governanceState.mode || 'unknown',
    realAutonomyScore: governanceState.realAutonomyScore == null ? 'unknown' : governanceState.realAutonomyScore,
    guardrailTestCount: guardrailTests.length,
    guardrailTests: guardrailTests.map((file) => relative(root, file)).slice(0, 12),
    hotPathFilesPresent: HOT_PATHS.filter((file) => fs.existsSync(path.join(root, file))),
    sourceFileCount: sourceFiles.length,
    reportFreshness: {
      productPressureReport: fileAge(root, 'PRODUCT_PRESSURE_REPORT.md'),
      productMaturityReport: fileAge(root, 'PRODUCT_MATURITY_REPORT.md')
    },
    maturityReportPresent: Boolean(maturityReport.trim())
  };
}

function buildRecommendation(evidence) {
  const hasFieldEvidence = evidence.aggregateEvidenceEntries > 0;
  const currentPressure = evidence.pressure.highest || 'unknown';
  const dangerousSubsystem = evidence.pressure.dangerousSubsystem || 'unknown';
  const retentionRisk = evidence.pressure.retentionRisk || 'unknown';
  const freeze = evidence.pressure.freeze || 'high-risk hot-path rewrites without evidence';

  const priority = currentPressure.includes('swipe')
    ? 'swipe trust'
    : currentPressure.includes('correction')
      ? 'correction burden'
      : 'typing feel evidence';

  const safeAction = hasFieldEvidence
    ? `propose one bounded ${priority} micro-experiment with rollback trigger`
    : 'improve evidence collection and report freshness before hot-path mutation';

  return {
    topPriority: priority,
    why: [
      `Current pressure report says: ${currentPressure}.`,
      `Most dangerous subsystem says: ${dangerousSubsystem}.`,
      `Retention risk says: ${retentionRisk}.`
    ],
    safeAction,
    blockedActions: [
      freeze,
      evidence.pressure.unsafeProposals || 'architecture rewrites and speculative AI upgrades',
      'direct mutation of KeyboardService.kt, SwipeGestureTracker.kt, SwipeWordResolver.kt, or BasicPredictor.kt without stronger evidence'
    ],
    autonomyMode: evidence.governanceMode === 'PRESERVATION_ONLY'
      ? 'analysis only'
      : hasFieldEvidence
        ? 'proposal plus low-risk non-hot-path execution'
        : 'research, reports, and safe proposals only',
    confidence: hasFieldEvidence ? 'medium' : 'low-medium',
    evidenceGap: hasFieldEvidence ? null : 'No aggregate product evidence entries are present yet.'
  };
}

function formatReport(evidence, recommendation) {
  return [
    '# PRODUCT_STEWARD_AUTONOMY_REPORT',
    '',
    '## What The Agents Researched',
    `- Roadmap phase: ${evidence.phase}`,
    `- Governance mode: ${evidence.governanceMode}`,
    `- REAL_AUTONOMY_SCORE: ${evidence.realAutonomyScore}`,
    `- Product pressure: ${evidence.pressure.highest || 'unknown'}`,
    `- Dangerous subsystem: ${evidence.pressure.dangerousSubsystem || 'unknown'}`,
    `- Retention risk: ${evidence.pressure.retentionRisk || 'unknown'}`,
    `- Aggregate product evidence entries: ${evidence.aggregateEvidenceEntries}`,
    `- Guardrail/product test files found: ${evidence.guardrailTestCount}`,
    '',
    '## Recommendation',
    `- Top priority: ${recommendation.topPriority}`,
    `- Safe action: ${recommendation.safeAction}`,
    `- Autonomy mode while founder is absent: ${recommendation.autonomyMode}`,
    `- Confidence: ${recommendation.confidence}`,
    '',
    '## Why',
    ...recommendation.why.map((line) => `- ${line}`),
    '',
    '## Do Not Automate Yet',
    ...recommendation.blockedActions.map((line) => `- ${line}`),
    '',
    '## Evidence Gaps',
    `- ${recommendation.evidenceGap || 'No major evidence gap detected for recommendation level.'}`,
    '',
    '## Verified Boundaries',
    ...evidence.hotPathFilesPresent.map((file) => `- Protected hot path present: ${file}`),
    '',
    '## Runtime Impact',
    '- Report generation only; no keyboard runtime mutation.',
    '',
    '## Retention Impact',
    '- Positive if agents follow this order because Phase 1 effort stays focused on trust, feel, and stability.',
    '',
    '## Rollback Complexity',
    '- Low. Delete this report or revert the commit.',
    ''
  ].join('\n');
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(file) {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  } catch {
    return '';
  }
}

function listFiles(dir, extension) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, extension));
    else if (!extension || full.endsWith(extension)) out.push(full);
  }
  return out;
}

function extractReportValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(markdown || '').match(new RegExp(`${escaped}:\\s*([^\\n]+)`, 'i'));
  return match ? match[1].trim().replace(/\.$/, '') : null;
}

function fileAge(root, relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return 'missing';
  const stat = fs.statSync(file);
  return stat.mtime.toISOString();
}

function relative(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

if (require.main === module) {
  const result = runProductStewardAutonomy({
    writeReport: !process.argv.includes('--dry-run')
  });
  process.stdout.write(result.report);
}

module.exports = {
  HOT_PATHS,
  collectEvidence,
  buildRecommendation,
  formatReport,
  runProductStewardAutonomy
};
