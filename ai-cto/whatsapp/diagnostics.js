const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const REQUIRED_FILES = [
  'ENGINEERING_REPORT.md',
  path.join('ai-cto', '.brain_state.json'),
  path.join('ai-cto', 'whatsapp-server.js')
];

function startupSelfCheck(config = {}) {
  const checks = [];

  for (const file of REQUIRED_FILES) {
    checks.push({
      name: `file:${file}`,
      ok: fs.existsSync(path.join(ROOT, file)),
      severity: file.endsWith('.json') ? 'warning' : 'critical'
    });
  }

  checks.push({
    name: 'twilio-auth-token',
    ok: Boolean(config.twilioAuthToken) || Boolean(config.allowUnverified),
    severity: config.nodeEnv === 'production' ? 'critical' : 'warning'
  });

  checks.push({
    name: 'founder-number',
    ok: Boolean(config.founderNumber),
    severity: config.nodeEnv === 'production' ? 'critical' : 'warning'
  });

  const criticalFailed = checks.some((check) => !check.ok && check.severity === 'critical');
  return {
    ok: !criticalFailed,
    generatedAt: new Date().toISOString(),
    checks
  };
}

function workflowFreshness(state, now = Date.now()) {
  const lastAnalysisMs = state.generatedAt ? Date.parse(state.generatedAt) : NaN;
  if (!Number.isFinite(lastAnalysisMs)) {
    return {
      ok: false,
      stale: true,
      ageHours: null,
      message: 'No valid CTO analysis timestamp is available.'
    };
  }

  const ageMs = Math.max(0, now - lastAnalysisMs);
  const ageHours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10;
  return {
    ok: ageMs <= TWELVE_HOURS_MS,
    stale: ageMs > TWELVE_HOURS_MS,
    ageHours,
    message: ageMs > TWELVE_HOURS_MS
      ? `CTO analysis is stale for ${ageHours}h. GitHub Actions may be failing.`
      : `CTO analysis is fresh (${ageHours}h old).`
  };
}

module.exports = {
  startupSelfCheck,
  workflowFreshness,
  TWELVE_HOURS_MS
};
