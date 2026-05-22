const fs = require('fs');
const path = require('path');
const { logAgentAction } = require('./agent-action-log');

const ROOT = path.resolve(__dirname, '..', '..');
const SPAWN_FILE = path.join(ROOT, 'ai-cto', 'spawned-agents.json');

function readSpawnState() {
  try {
    if (!fs.existsSync(SPAWN_FILE)) return { version: '1.0', pending: null, active: [] };
    const parsed = JSON.parse(fs.readFileSync(SPAWN_FILE, 'utf8'));
    return {
      version: '1.0',
      pending: parsed.pending || null,
      active: Array.isArray(parsed.active) ? parsed.active : []
    };
  } catch {
    return { version: '1.0', pending: null, active: [] };
  }
}

function writeSpawnState(state) {
  const next = {
    version: '1.0',
    pending: state.pending || null,
    active: Array.isArray(state.active) ? state.active : []
  };
  fs.writeFileSync(SPAWN_FILE, JSON.stringify(next, null, 2));
  return next;
}

function requestSpecialistSpawn({ name, reason, task, duration }) {
  const state = readSpawnState();
  const proposal = {
    id: `spawn-${Date.now()}`,
    name: sanitizeName(name),
    reason: compact(reason || 'Needs focused expertise existing agents do not have.', 120),
    task: compact(task || 'Focused investigation only.', 120),
    duration: compact(duration || 'one maintenance cycle', 80),
    status: 'PENDING_FOUNDER_APPROVAL',
    requestedAt: new Date().toISOString()
  };
  writeSpawnState({ ...state, pending: proposal });
  logAgentAction({
    agentName: 'CTO',
    actionTaken: `requested specialist spawn: ${proposal.name}`,
    reason: proposal.reason,
    riskLevel: 'MEDIUM',
    outcome: 'WAITING_FOR_FOUNDER_YES_OR_NO'
  });
  return proposal;
}

function answerSpecialistSpawn(answer) {
  const normalized = String(answer || '').trim().toLowerCase();
  const state = readSpawnState();
  if (!state.pending) {
    return { status: 'NO_PENDING_SPAWN', message: 'No pending specialist spawn request.' };
  }
  if (!['yes', 'y', 'no', 'n'].includes(normalized)) {
    return { status: 'WAITING', message: 'Reply YES or NO for the specialist spawn.' };
  }
  if (normalized === 'no' || normalized === 'n') {
    const denied = { ...state.pending, status: 'DENIED', decidedAt: new Date().toISOString() };
    writeSpawnState({ ...state, pending: null });
    logAgentAction({
      agentName: 'CTO',
      actionTaken: `cancelled specialist spawn: ${denied.name}`,
      reason: 'Founder denied spawn request.',
      riskLevel: 'LOW',
      outcome: 'DENIED'
    });
    return { status: 'DENIED', agent: denied };
  }
  const active = {
    ...state.pending,
    status: 'ACTIVE',
    approvedAt: new Date().toISOString(),
    reportsTo: 'CTO',
    trustRules: 'same as CTO/Coder/Reviewer/Auditor',
    expiresWhen: 'task complete or duration elapsed unless founder says keep it'
  };
  writeSpawnState({ pending: null, active: [...state.active, active].slice(-10) });
  logAgentAction({
    agentName: 'CTO',
    actionTaken: `spawned specialist agent: ${active.name}`,
    reason: active.reason,
    riskLevel: 'MEDIUM',
    outcome: 'ACTIVE_UNTIL_DONE_OR_EXPIRED'
  });
  return { status: 'APPROVED', agent: active };
}

function parseSpawnRequest(message) {
  const normalized = String(message || '').trim();
  const match = normalized.match(/\bspawn\s+([a-z0-9 _-]{3,40})(?:\s+for\s+(.+))?/i);
  if (!match) return null;
  const name = match[1].trim();
  const task = match[2] ? match[2].trim() : `Deep focused help from ${name}`;
  return {
    name,
    reason: `${name} expertise is needed beyond CTO/Coder/Reviewer/Auditor scope.`,
    task,
    duration: 'one focused cycle'
  };
}

function sanitizeName(value) {
  return String(value || 'Specialist').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 40) || 'Specialist';
}

function compact(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  SPAWN_FILE,
  readSpawnState,
  requestSpecialistSpawn,
  answerSpecialistSpawn,
  parseSpawnRequest
};
