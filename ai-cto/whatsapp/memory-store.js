const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_FILE = path.join(ROOT, 'ai-cto', '.whatsapp_memory.json');

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
    return { ...DEFAULT_MEMORY, ...parsed, version: DEFAULT_MEMORY.version };
  } catch {
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
  updateMemory,
  MEMORY_FILE
};
