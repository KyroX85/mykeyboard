const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runBrain } = require('../brain');
const { routeMessage } = require('../whatsapp/command-router');

const root = path.resolve(__dirname, '..', '..');
const stateFile = path.join(root, 'ai-cto', '.brain_state.json');
const reportFile = path.join(root, 'ENGINEERING_REPORT.md');
const actionLogFile = path.join(root, 'ai-cto', 'agent-action-log.json');
const probeFile = path.join(root, 'live_secret_probe.js');

const originalState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null;
const originalReport = fs.existsSync(reportFile) ? fs.readFileSync(reportFile, 'utf8') : null;
const originalActionLog = fs.existsSync(actionLogFile) ? fs.readFileSync(actionLogFile, 'utf8') : null;

function restore() {
  if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
  if (originalState == null) {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  } else {
    fs.writeFileSync(stateFile, originalState);
  }
  if (originalReport == null) {
    if (fs.existsSync(reportFile)) fs.unlinkSync(reportFile);
  } else {
    fs.writeFileSync(reportFile, originalReport);
  }
  if (originalActionLog == null) {
    if (fs.existsSync(actionLogFile)) fs.unlinkSync(actionLogFile);
  } else {
    fs.writeFileSync(actionLogFile, originalActionLog);
  }
}

try {
  fs.writeFileSync(stateFile, JSON.stringify({
    version: '3.0',
    unresolvedIssues: [{
      type: 'SECURITY',
      impact: 'CRITICAL',
      message: 'STALE_SECRET_NEVER_REPORT',
      file: 'deleted-file.js',
      source: 'OLD_STATE'
    }],
    healthScore: 0,
    momentum: 'STALE',
    trendHistory: [],
    recurringFailures: {},
    fileInstability: {}
  }, null, 2));

  fs.writeFileSync(probeFile, "const apiKey = 'live_secret_probe_12345';\n");
  const fresh = runBrain();
  const report = fs.readFileSync(reportFile, 'utf8');
  const persisted = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

  assert.strictEqual(fresh.scanMode, 'LIVE_REPO_SCAN');
  assert.strictEqual(persisted.scanMode, 'LIVE_REPO_SCAN');
  assert.strictEqual(persisted.liveScan.source, 'actual_repo_files');
  assert(report.includes('SCAN MODE: LIVE_REPO_SCAN'));
  assert(report.includes('Hardcoded Secret in live_secret_probe.js'));
  assert(!report.includes('STALE_SECRET_NEVER_REPORT'));
  assert(persisted.unresolvedIssues.some((issue) =>
    issue.file === 'live_secret_probe.js' &&
    issue.source === 'LIVE_GREP' &&
    issue.message.includes('Hardcoded Secret')
  ));

  const scanResponse = routeMessage('scan now', {
    healthScore: 100,
    momentum: 'STALE',
    sections: {
      risks: [],
      unresolved: [],
      repeatedFailures: [],
      completedFixes: [],
      approvals: [],
      nextPriority: [],
      safestOpportunity: []
    },
    changed: { completed: [], newRisks: [] },
    validation: [],
    summary: { nextPriority: 'none', topRisk: 'none' }
  }).response;
  assert(scanResponse.includes('Fresh live scan done'));
  assert(scanResponse.includes('State updated from real repo files'));
  assert(scanResponse.includes('live_secret_probe.js'));

  console.log('Live scan grounding checks passed.');
} finally {
  restore();
}
