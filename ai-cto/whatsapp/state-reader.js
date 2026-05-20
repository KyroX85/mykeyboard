const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_FILE = path.join(ROOT, 'ENGINEERING_REPORT.md');
const BRAIN_STATE_FILE = path.join(ROOT, 'ai-cto', '.brain_state.json');
const VALIDATION_FILE = path.join(ROOT, 'ai-cto', 'validation-results.json');

function readText(file, fallback = '') {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback;
  } catch {
    return fallback;
  }
}

function readJsonWithRecovery(file, fallback = null) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch (error) {
    recoverCorruptJson(file, error);
    return fallback;
  }
}

function recoverCorruptJson(file, error) {
  try {
    if (!fs.existsSync(file)) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, `${file}.corrupt-${timestamp}`);
    fs.writeFileSync(file, JSON.stringify({
      version: 'recovered',
      recoveredAt: new Date().toISOString(),
      recoveryReason: `Invalid JSON: ${error.message}`,
      unresolvedIssues: [],
      healthScore: null,
      momentum: 'UNKNOWN'
    }, null, 2));
  } catch {
    // Recovery failure should not take down the webhook.
  }
}

function section(report, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:|\\n-{5,}|$)`, 'i');
  const match = report.match(regex);
  return match ? match[1].trim() : '';
}

function firstListItems(text, limit = 5) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(0, limit)
    .map((line) => line.replace(/^- /, ''));
}

function loadEngineeringState() {
  const report = readText(REPORT_FILE);
  const brain = readJsonWithRecovery(BRAIN_STATE_FILE, {});
  const validation = readJsonWithRecovery(VALIDATION_FILE, {});
  const latestValidationFailure = Array.isArray(validation.findings) && validation.findings.length > 0
    ? validation.findings[0]
    : null;

  const state = {
    generatedAt: brain.lastAnalysis || validation.generatedAt || null,
    healthScore: Number.isFinite(brain.healthScore) ? brain.healthScore : extractHealthScore(report),
    momentum: brain.momentum || extractMomentum(report),
    unresolvedIssues: Array.isArray(brain.unresolvedIssues) ? brain.unresolvedIssues : [],
    recurringFailures: brain.recurringFailures || {},
    fileInstability: brain.fileInstability || {},
    latestValidationFailure,
    validation: Array.isArray(validation.validation) ? validation.validation : [],
    report,
    sections: {
      risks: firstListItems(section(report, 'NEW REGRESSIONS AND CRITICAL RISKS')),
      unresolved: firstListItems(section(report, 'UNRESOLVED ISSUES')),
      repeatedFailures: firstListItems(section(report, 'REPEATED FAILURES')),
      unstableFiles: firstListItems(section(report, 'FILES BECOMING UNSTABLE')),
      completedFixes: firstListItems(section(report, 'COMPLETED FIXES')),
      approvals: firstListItems(section(report, 'PENDING APPROVALS')),
      nextPriority: firstListItems(section(report, 'SUGGESTED NEXT PRIORITY'), 1),
      safestOpportunity: firstListItems(section(report, 'SAFEST IMPROVEMENT OPPORTUNITY'), 1)
    },
    changed: summarizeChanges(report, brain)
  };
  state.summary = compressReportSummary(state);
  return state;
}

function compressReportSummary(state) {
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  return {
    health,
    momentum: state.momentum || 'UNKNOWN',
    topRisk: state.sections.risks[0] || state.sections.unresolved[0] || 'No current risk recorded.',
    nextPriority: state.sections.nextPriority[0] || 'No next priority recorded.',
    lastAnalysis: state.generatedAt || 'not recorded yet'
  };
}

function extractHealthScore(report) {
  const match = report.match(/HEALTH SCORE:\s*(\d+)\/100/i);
  return match ? Number(match[1]) : null;
}

function extractMomentum(report) {
  const match = report.match(/MOMENTUM:\s*([A-Z_ -]+)/i);
  return match ? match[1].trim() : 'UNKNOWN';
}

function summarizeChanges(report, brain) {
  const completed = firstListItems(section(report, 'COMPLETED FIXES'), 3);
  const newRisks = firstListItems(section(report, 'NEW REGRESSIONS AND CRITICAL RISKS'), 3);
  const history = Array.isArray(brain.trendHistory) ? brain.trendHistory : [];
  const lastTrend = history.length > 0 ? history[history.length - 1] : null;

  return {
    completed,
    newRisks,
    lastTrendAt: lastTrend ? lastTrend.at : null,
    issueCount: lastTrend && Array.isArray(lastTrend.issues) ? lastTrend.issues.length : null
  };
}

module.exports = {
  loadEngineeringState,
  firstListItems,
  readJsonWithRecovery,
  compressReportSummary
};
