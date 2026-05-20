const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_FILE = path.join(ROOT, 'ai-cto', '.whatsapp_memory.json');
const MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_MEMORY = {
  version: '1.0',
  lastRequestedFocusArea: null,
  latestUnresolvedIssue: null,
  lastHealthScore: null,
  latestMomentumState: null,
  lastCommand: null,
  lastUpdatedAt: null
};

function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { ...DEFAULT_MEMORY };
    const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    const memory = { ...DEFAULT_MEMORY, ...parsed, version: DEFAULT_MEMORY.version };
    return cleanupStaleMemory(memory);
  } catch (error) {
    recoverCorruptMemory(error);
    return { ...DEFAULT_MEMORY };
  }
}

function writeMemory(memory) {
  const next = {
    ...DEFAULT_MEMORY,
    ...memory,
    version: DEFAULT_MEMORY.version,
    lastUpdatedAt: new Date().toISOString()
  };

  try {
    const tmp = `${MEMORY_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, MEMORY_FILE);
  } catch {
    return readMemory();
  }

  return next;
}

function cleanupStaleMemory(memory) {
  if (!memory.lastUpdatedAt) return memory;
  const updatedAt = Date.parse(memory.lastUpdatedAt);
  if (!Number.isFinite(updatedAt)) return { ...DEFAULT_MEMORY };
  if (Date.now() - updatedAt <= MEMORY_TTL_MS) return memory;
  return writeMemory({
    ...DEFAULT_MEMORY,
    lastHealthScore: memory.lastHealthScore,
    latestMomentumState: memory.latestMomentumState
  });
}

function recoverCorruptMemory(error) {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(MEMORY_FILE, `${MEMORY_FILE}.corrupt-${timestamp}`);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
      ...DEFAULT_MEMORY,
      recoveredAt: new Date().toISOString(),
      recoveryReason: `Invalid JSON: ${error.message}`
    }, null, 2));
  } catch {
    // Memory recovery must not block webhook responses.
  }
}

function updateMemory(command, state, details = {}) {
  const memory = readMemory();
  const latestUnresolvedIssue =
    state.sections.unresolved[0] ||
    state.sections.risks[0] ||
    memory.latestUnresolvedIssue ||
    null;

  return writeMemory({
    ...memory,
    lastCommand: command,
    lastRequestedFocusArea: details.focusTopic || memory.lastRequestedFocusArea,
    latestUnresolvedIssue,
    lastHealthScore: state.healthScore == null ? memory.lastHealthScore : state.healthScore,
    latestMomentumState: state.momentum || memory.latestMomentumState
  });
}

module.exports = {
  readMemory,
  writeMemory,
  updateMemory,
  MEMORY_FILE
};
