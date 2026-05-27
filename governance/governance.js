const fs = require('fs');
const path = require('path');

const STATE_FILE = process.env.ARITENIS_GOVERNANCE_STATE_FILE
  ? path.resolve(process.env.ARITENIS_GOVERNANCE_STATE_FILE)
  : path.join(__dirname, '..', 'ai-cto', 'governance-state.json');
const PRESERVATION_ONLY = 'PRESERVATION_ONLY';
let memoryState = null;

function readState() {
  if (memoryState) return memoryState;
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { mode: 'ACTIVE', realAutonomyScore: 62, incidents: [] };
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { mode: 'ACTIVE', realAutonomyScore: 50, incidents: [] };
  }
}

function writeState(state) {
  memoryState = state;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    // Fallback to in-memory state when filesystem is write-restricted in tests/runtime sandboxes.
  }
}

function setMode(mode, reason = '') {
  const state = readState();
  state.mode = mode;
  if (reason) state.lastReason = reason.slice(0, 240);
  state.updatedAt = new Date().toISOString();
  writeState(state);
  return state;
}

function decayAutonomyScore(delta, incident) {
  const state = readState();
  const next = Math.max(0, Math.min(100, Number(state.realAutonomyScore || 60) + Number(delta || 0)));
  state.realAutonomyScore = next;
  if (incident) {
    state.incidents = [...(state.incidents || []), { at: new Date().toISOString(), ...incident }].slice(-200);
  }
  writeState(state);
  return state;
}

function enforceExecutionAllowed(action = 'unknown', context = {}) {
  const state = readState();
  const mutationActions = new Set([
    'commit', 'push', 'file_write', 'file_delete', 'file_modify', 'branch_create', 'execute_mutation'
  ]);
  if (state.mode === PRESERVATION_ONLY && mutationActions.has(action)) {
    decayAutonomyScore(-8, {
      type: 'preservation_bypass_attempt',
      action,
      context: summarizeContext(context)
    });
    return {
      allowed: false,
      status: 'BLOCKED',
      reason: `Governance mode is ${PRESERVATION_ONLY}; mutation is not allowed.`,
      mode: state.mode
    };
  }
  return { allowed: true, status: 'ALLOWED', mode: state.mode };
}

function summarizeContext(context) {
  return {
    source: String(context.source || '').slice(0, 120),
    fileCount: Array.isArray(context.files) ? context.files.length : 0,
    task: String(context.task || '').slice(0, 160)
  };
}

module.exports = {
  PRESERVATION_ONLY,
  readState,
  writeState,
  setMode,
  decayAutonomyScore,
  enforceExecutionAllowed
};
