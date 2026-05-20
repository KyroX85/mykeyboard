const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ACTIONS_FILE = path.join(ROOT, 'ai-cto', 'maintenance-actions.json');

function readMaintenanceActions() {
  try {
    if (!fs.existsSync(ACTIONS_FILE)) return { version: '1.0', actions: [] };
    const parsed = JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'));
    return {
      version: '1.0',
      updated_at: parsed.updated_at || null,
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    };
  } catch {
    return { version: '1.0', actions: [] };
  }
}

function maintenanceSnapshot() {
  const state = readMaintenanceActions();
  const recent = state.actions.slice(-10).reverse();
  return {
    updated_at: state.updated_at || null,
    recent,
    executed: recent.filter((action) => action.result === 'EXECUTED'),
    dryRun: recent.filter((action) => action.result === 'DRY_RUN'),
    skipped: recent.filter((action) => action.result === 'SKIPPED'),
    blocked: recent.filter((action) => action.result === 'BLOCKED')
  };
}

function formatMaintenanceActions(actions, fallback) {
  if (!actions || actions.length === 0) return [`\u2022 ${fallback}`];
  return actions.slice(0, 5).map((action) =>
    `\u2022 ${action.action} [${action.risk}/${action.result}] ${action.file || 'repo'}`
  );
}

module.exports = {
  readMaintenanceActions,
  maintenanceSnapshot,
  formatMaintenanceActions
};
