const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EXECUTION_FILE = path.join(ROOT, 'ai-cto', 'execution-log.json');

function readExecutionLog() {
  try {
    if (!fs.existsSync(EXECUTION_FILE)) return { version: '1.0', executions: [] };
    const parsed = JSON.parse(fs.readFileSync(EXECUTION_FILE, 'utf8'));
    return {
      version: '1.0',
      updated_at: parsed.updated_at || null,
      executions: Array.isArray(parsed.executions) ? parsed.executions : []
    };
  } catch {
    return { version: '1.0', executions: [] };
  }
}

function executionSnapshot() {
  const state = readExecutionLog();
  const recent = state.executions.slice(-10).reverse();
  return {
    updated_at: state.updated_at || null,
    recent,
    dryRun: recent.filter((entry) => entry.result === 'DRY_RUN'),
    completed: recent.filter((entry) => entry.state === 'COMPLETED'),
    blocked: recent.filter((entry) => entry.state === 'BLOCKED'),
    rolledBack: recent.filter((entry) => entry.state === 'ROLLED_BACK')
  };
}

function formatExecutionEntries(entries, fallback) {
  if (!entries || entries.length === 0) return [`\u2022 ${fallback}`];
  return entries.slice(0, 5).map((entry) =>
    `\u2022 ${entry.owning_agent || 'Agent'} ${entry.action} [${entry.state}/${entry.result}]`
  );
}

module.exports = {
  readExecutionLog,
  executionSnapshot,
  formatExecutionEntries
};
