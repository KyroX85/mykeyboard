const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ACTION_LOG_FILE = process.env.ARITENIS_ACTION_LOG_FILE
  ? path.resolve(process.env.ARITENIS_ACTION_LOG_FILE)
  : path.join(ROOT, 'ai-cto', 'agent-action-log.json');
const MAX_ACTIONS = 500;

function readActionLog() {
  try {
    if (!fs.existsSync(ACTION_LOG_FILE)) return { version: '1.0', actions: [] };
    const parsed = JSON.parse(fs.readFileSync(ACTION_LOG_FILE, 'utf8'));
    return {
      version: '1.0',
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    };
  } catch {
    return { version: '1.0', actions: [] };
  }
}

function logAgentAction({ agentName, actionTaken, reason, riskLevel = 'LOW', outcome = 'RECORDED', ...metadata }) {
  const current = readActionLog();
  const entry = {
    timestamp: new Date().toISOString(),
    agentName: agentName || 'CTO',
    actionTaken: actionTaken || 'unspecified action',
    reason: reason || 'No reason recorded.',
    riskLevel: String(riskLevel || 'LOW').toUpperCase(),
    outcome: outcome || 'RECORDED',
    ...metadata
  };
  const next = {
    version: '1.0',
    actions: [...current.actions, entry].slice(-MAX_ACTIONS)
  };
  try {
    fs.mkdirSync(path.dirname(ACTION_LOG_FILE), { recursive: true });
    fs.writeFileSync(ACTION_LOG_FILE, JSON.stringify(next, null, 2));
  } catch {
    // Logging must never break WhatsApp routing or test execution.
  }
  return entry;
}

module.exports = {
  ACTION_LOG_FILE,
  readActionLog,
  logAgentAction
};
