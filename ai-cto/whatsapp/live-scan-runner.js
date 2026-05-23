const { execFileSync } = require('child_process');
const { loadEngineeringState } = require('./state-reader');
const { logAgentAction } = require('./agent-action-log');

function runFreshScan() {
  const startedAt = Date.now();
  execFileSync(process.execPath, ['ai-cto/brain.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60000
  });
  const state = loadEngineeringState();
  logAgentAction({
    agentName: 'CTO',
    actionTaken: 'forced fresh live repo scan',
    reason: 'Founder requested scan now; state must follow real files.',
    riskLevel: 'LOW',
    outcome: `LIVE_SCAN_COMPLETE issues=${state.unresolvedIssues.length} durationMs=${Date.now() - startedAt}`
  });
  return state;
}

function formatFreshScanResponse(state) {
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  const top = state.sections.risks[0] || state.sections.unresolved[0] || 'No active finding from live scan.';
  const secrets = state.unresolvedIssues.filter((issue) => issue.type === 'SECURITY' && issue.source === 'LIVE_GREP');
  const secretFiles = secrets.map((issue) => issue.file).filter(Boolean).slice(0, 3).join(', ');
  return [
    '🎯 CTO: Fresh live scan is complete.',
    `Health: ${health}. Momentum: ${state.momentum || 'UNKNOWN'}.`,
    `Top finding: ${top}`,
    secrets.length ? `🚨 AUDITOR: Live grep caught ${secrets.length} secret risk(s): ${secretFiles}.` : '🚨 AUDITOR: Live grep found no hardcoded secret.',
    'State updated from real repo files, not cached memory.'
  ].join('\n');
}

module.exports = {
  runFreshScan,
  formatFreshScanResponse
};
