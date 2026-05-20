const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LOG_FILE = path.join(ROOT, 'test_output.log');
const BRAIN_STATE_FILE = path.join(__dirname, '.brain_state.json');
const REPORT_FILE = path.join(ROOT, 'ENGINEERING_REPORT.md');
const VALIDATION_FILE = path.join(__dirname, 'validation-results.json');
const AUTOFIX_FILE = path.join(__dirname, 'autofix-summary.json');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let state = {
  version: '3.0',
  unresolvedIssues: [],
  lastAnalysis: null,
  healthScore: 100,
  momentum: 'STABLE',
  trendHistory: [],
  recurringFailures: {},
  fileInstability: {}
};

function log(message) {
  console.log(`[brain] ${message}`);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    log(`Invalid JSON ignored: ${path.relative(ROOT, file)} (${error.message})`);
    return fallback;
  }
}

function loadState() {
  state = { ...state, ...readJson(BRAIN_STATE_FILE, {}) };
  state.version = '3.0';
  state.trendHistory = Array.isArray(state.trendHistory) ? state.trendHistory : [];
  state.unresolvedIssues = Array.isArray(state.unresolvedIssues) ? state.unresolvedIssues : [];
  state.recurringFailures = state.recurringFailures || {};
  state.fileInstability = state.fileInstability || {};
}

function saveState() {
  const tmp = `${BRAIN_STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, BRAIN_STATE_FILE);
}

function issueKey(issue) {
  return [issue.type, issue.file || 'repo', issue.message].join('|');
}

function normalizeIssue(issue) {
  return {
    type: issue.type || 'ISSUE',
    impact: issue.impact || 'MEDIUM',
    message: String(issue.message || 'Unspecified issue').slice(0, 300),
    file: issue.file || null,
    task: issue.task || null,
    source: issue.source || 'SCAN',
    classification: issue.classification || 'REVIEW_REQUIRED'
  };
}

function analyzeFailuresFromLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const findings = [];
  const failRegex = /(FAIL|FAILED|FAILURE|Error|Exception|ERR!|critical):?\s+(.*)/i;

  content.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(failRegex);
    if (!match) return;
    const fileMatch = line.match(/([\w./\\-]+\.(kt|java|xml|gradle|kts|js))/i);
    findings.push(normalizeIssue({
      type: 'TEST_FAILURE',
      impact: 'HIGH',
      message: match[2].trim() || line.trim(),
      file: fileMatch ? fileMatch[1].replace(/\\/g, '/') : null,
      line: index + 1,
      source: 'TEST_LOG'
    }));
  });

  return findings;
}

function validationFindings() {
  const validation = readJson(VALIDATION_FILE, { findings: [] });
  return Array.isArray(validation.findings)
    ? validation.findings.map(normalizeIssue)
    : [];
}

function deepCodeScan(dir, findings = []) {
  if (shouldIgnore(dir)) return findings;

  for (const entry of safeReadDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deepCodeScan(full, findings);
      continue;
    }
    if (!/\.(js|py|kt)$/.test(entry.name)) continue;

    const relative = path.relative(ROOT, full).replace(/\\/g, '/');
    const code = fs.readFileSync(full, 'utf8');
    const codeWithoutComments = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    if (/(?:key|password|secret|token|auth)[a-z0-9_]*\s*[:=]\s*['"][a-zA-Z0-9_\-\s]{10,}['"]/i.test(code)) {
      findings.push(normalizeIssue({
        type: 'SECURITY',
        impact: 'CRITICAL',
        message: `Hardcoded Secret in ${entry.name}`,
        file: relative,
        source: 'DEEP_SCAN'
      }));
    }

    if (code.split(/\r?\n/).length > 500) {
      findings.push(normalizeIssue({
        type: 'COMPLEXITY',
        impact: 'MEDIUM',
        message: `File ${entry.name} is too large (>500 lines)`,
        file: relative,
        source: 'DEEP_SCAN'
      }));
    }

    if (codeWithoutComments.includes('try {') && !/\bcatch\b/.test(codeWithoutComments)) {
      findings.push(normalizeIssue({
        type: 'ARCHITECTURE',
        impact: 'HIGH',
        message: `Unsafe Try Block in ${entry.name}`,
        file: relative,
        source: 'DEEP_SCAN'
      }));
    }
  }

  return findings;
}

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function shouldIgnore(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return ['.git', '.gradle', '.idea', 'node_modules', 'dist', 'build', 'ai-cto'].some(part => parts.includes(part));
}

function uniqueIssues(issues) {
  const seen = new Set();
  const result = [];
  for (const issue of issues.map(normalizeIssue)) {
    const key = issueKey(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result;
}

function riskRank(issue) {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[issue.impact] ?? 9;
}

function sortByRisk(issues) {
  return [...issues].sort((a, b) => riskRank(a) - riskRank(b) || issueKey(a).localeCompare(issueKey(b)));
}

function calculateHealth(issues) {
  let score = 100;
  for (const issue of issues) {
    if (issue.impact === 'CRITICAL') score -= 25;
    else if (issue.impact === 'HIGH') score -= 15;
    else if (issue.impact === 'MEDIUM') score -= 5;
    else score -= 2;
  }
  state.healthScore = Math.max(0, score);
  state.momentum = state.healthScore < 70 ? 'STALLED' : (state.healthScore < 90 ? 'RECOVERING' : 'CLIMBING');
}

function updateTrends(issues, now) {
  const cutoff = Date.parse(now) - THIRTY_DAYS_MS;
  const snapshot = {
    timestamp: now,
    healthScore: state.healthScore,
    momentum: state.momentum,
    issueCount: issues.length,
    criticalCount: issues.filter(issue => issue.impact === 'CRITICAL').length,
    highCount: issues.filter(issue => issue.impact === 'HIGH').length,
    files: issues.map(issue => issue.file).filter(Boolean)
  };

  state.trendHistory = [...state.trendHistory, snapshot]
    .filter(item => Date.parse(item.timestamp) >= cutoff)
    .slice(-180);

  state.recurringFailures = {};
  state.fileInstability = {};

  for (const entry of state.trendHistory) {
    for (const file of entry.files || []) {
      state.fileInstability[file] = (state.fileInstability[file] || 0) + 1;
    }
  }

  for (const issue of issues) {
    const key = issueKey(issue);
    state.recurringFailures[key] = (state.recurringFailures[key] || 0) + 1;
  }
}

function requiresApproval(issue) {
  const message = `${issue.message} ${issue.file || ''}`.toLowerCase();
  return issue.impact === 'CRITICAL' ||
    message.includes('prediction') ||
    message.includes('persistence') ||
    message.includes('storage') ||
    message.includes('database') ||
    message.includes('network') ||
    message.includes('telemetry') ||
    message.includes('privacy') ||
    message.includes('gesture') ||
    message.includes('swipe') ||
    message.includes('architecture');
}

function formatIssue(issue) {
  const file = issue.file ? ` (${issue.file})` : '';
  const task = issue.task ? ` task=${issue.task}` : '';
  return `- [${issue.impact}] ${issue.type}: ${issue.message}${file}${task}`;
}

function topUnstableFiles(limit = 5) {
  return Object.entries(state.fileInstability)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([file, count]) => `- ${file}: ${count} appearances in 30-day trend`);
}

function repeatedFailures(issues) {
  return sortByRisk(issues)
    .filter(issue => (state.recurringFailures[issueKey(issue)] || 0) > 1)
    .slice(0, 5)
    .map(issue => `${formatIssue(issue)} recurrence=${state.recurringFailures[issueKey(issue)]}`);
}

function safestOpportunity(issues) {
  const lowRisk = issues.find(issue => issue.impact === 'LOW') || issues.find(issue => issue.impact === 'MEDIUM');
  if (!lowRisk) return '- No safe autonomous code fix is currently recommended.';
  if (lowRisk.type === 'COMPLEXITY') return `- Plan a small review-only refactor for ${lowRisk.file}; do not auto-apply.`;
  return `- Review low-risk item: ${lowRisk.message}`;
}

function nextPriorityFor(issue) {
  if (issue.type === 'SECURITY') return `Audit and remove ${issue.message}. Rotate any real credential if applicable.`;
  if (issue.type === 'BUILD_VALIDATION') return `Stabilize Android task ${issue.task}: ${issue.message}.`;
  if (issue.type === 'LINT') return `Fix lint finding from ${issue.task}: ${issue.message}.`;
  if (issue.type === 'ARCHITECTURE') return `Add explicit error handling for ${issue.message}.`;
  if (issue.type === 'COMPLEXITY') return `Plan a small, reversible split for ${issue.message}.`;
  return `Review ${issue.message}.`;
}

function autofixSummary() {
  const summary = readJson(AUTOFIX_FILE, { changes: [] });
  const changes = Array.isArray(summary.changes) ? summary.changes : [];
  return changes.length === 0
    ? ['- No safe autonomous code fix was applied in this run.']
    : changes.map(change => `- ${change.action}: ${change.file}`);
}

function generateReport(issues) {
  const critical = issues.filter(issue => issue.impact === 'CRITICAL');
  const pendingApprovals = issues.filter(requiresApproval);
  const priorities = sortByRisk(issues).slice(0, 5).map(nextPriorityFor);
  const repeated = repeatedFailures(issues);
  const unstableFiles = topUnstableFiles();
  const now = state.lastAnalysis;

  let report = `ARITENIS AI CTO REPORT [CONTROLLED EXECUTION]\n`;
  report += `DATE: ${now}\n`;
  report += `HEALTH SCORE: ${state.healthScore}/100\n`;
  report += `MOMENTUM: ${state.momentum}\n`;
  report += `-------------------------------------------\n\n`;

  report += `NEW REGRESSIONS AND CRITICAL RISKS:\n`;
  report += critical.length ? critical.map(formatIssue).join('\n') + '\n' : '- None detected.\n';
  report += `\n`;

  report += `UNRESOLVED ISSUES:\n`;
  report += issues.length ? sortByRisk(issues).map(formatIssue).join('\n') + '\n' : '- None detected.\n';
  report += `\n`;

  report += `REPEATED FAILURES:\n`;
  report += repeated.length ? repeated.join('\n') + '\n' : '- No recurring failure pattern detected yet.\n';
  report += `\n`;

  report += `FILES BECOMING UNSTABLE:\n`;
  report += unstableFiles.length ? unstableFiles.join('\n') + '\n' : '- No file instability trend yet.\n';
  report += `\n`;

  report += `COMPLETED FIXES:\n`;
  report += autofixSummary().join('\n') + '\n';
  report += `- Report and state generation completed for this run.\n\n`;

  report += `PENDING APPROVALS:\n`;
  report += pendingApprovals.length ? pendingApprovals.map(formatIssue).join('\n') + '\n' : '- None.\n';
  report += `\n`;

  report += `SUGGESTED NEXT PRIORITY:\n`;
  report += priorities.length ? `- ${priorities[0]}\n` : '- Keep monitoring scheduled runs and avoid unnecessary churn.\n';
  report += `\n`;

  report += `SAFEST IMPROVEMENT OPPORTUNITY:\n`;
  report += `${safestOpportunity(issues)}\n\n`;

  report += `SAFETY BOUNDARIES:\n`;
  report += `- Predictor, database, networking, privacy, lifecycle, gesture, and swipe changes require founder approval.\n`;
  report += `- Safe changes must go through PR review. No direct push to protected branches.\n`;
  report += `- Dangerous changes are report-only and never auto-merge.\n`;

  fs.writeFileSync(REPORT_FILE, report);
  log(`Controlled analysis complete: ${state.healthScore}% health; issues=${issues.length}.`);
}

loadState();
const now = new Date().toISOString();
const hasStructuredValidation = fs.existsSync(VALIDATION_FILE);
const androidFindings = validationFindings();
const issues = uniqueIssues([
  ...androidFindings,
  ...(hasStructuredValidation ? [] : analyzeFailuresFromLog()),
  ...deepCodeScan(ROOT)
]);

calculateHealth(issues);
state.lastAnalysis = now;
state.unresolvedIssues = sortByRisk(issues).map(issue => ({ ...issue, detectedAt: now }));
updateTrends(state.unresolvedIssues, now);
saveState();
generateReport(state.unresolvedIssues);
