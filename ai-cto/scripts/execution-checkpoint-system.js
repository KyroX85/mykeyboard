const fs = require('fs');
const path = require('path');

const CHECKPOINT_DIR = path.join('ai-cto', 'execution-checkpoints');
const LOCK_FILE = path.join('ai-cto', 'execution-lock.json');
const DEFAULT_STALE_MS = 15 * 60 * 1000;

function beginExecutionCheckpoint(root, { executionId, files = [], action = 'execution' } = {}) {
  const repoRoot = path.resolve(root || process.cwd());
  const id = String(executionId || `exec-${Date.now()}`);
  const lock = readLock(repoRoot);
  if (lock && lock.status === 'IN_PROGRESS' && lock.executionId === id) {
    throw new Error(`Duplicate execution attempt blocked: ${id}`);
  }
  if (lock && lock.status === 'IN_PROGRESS') {
    throw new Error(`Execution already in progress: ${lock.executionId}`);
  }

  const checkpoint = {
    id,
    executionId: id,
    action: String(action || 'execution').slice(0, 160),
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    files: array(files).map(normalizePath),
    snapshots: {}
  };
  for (const file of checkpoint.files) {
    const target = repoPath(repoRoot, file);
    checkpoint.snapshots[file] = {
      existed: fs.existsSync(target),
      content: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null
    };
  }
  writeJson(checkpointPath(repoRoot, id), checkpoint);
  writeJson(path.join(repoRoot, LOCK_FILE), {
    executionId: id,
    checkpointId: id,
    action: checkpoint.action,
    status: 'IN_PROGRESS',
    createdAt: checkpoint.createdAt
  });
  return checkpoint;
}

function completeExecutionCheckpoint(root, checkpointId, result = {}) {
  const repoRoot = path.resolve(root || process.cwd());
  const file = checkpointPath(repoRoot, checkpointId);
  const checkpoint = readJson(file, null);
  if (!checkpoint) return { completed: false, reason: 'checkpoint missing' };
  checkpoint.status = 'COMPLETED';
  checkpoint.completedAt = new Date().toISOString();
  checkpoint.result = result;
  writeJson(file, checkpoint);
  removeLock(repoRoot, checkpointId);
  return { completed: true, checkpoint };
}

function restoreCheckpoint(root, checkpointId, reason = 'manual restore') {
  const repoRoot = path.resolve(root || process.cwd());
  const checkpoint = readJson(checkpointPath(repoRoot, checkpointId), null);
  if (!checkpoint || !checkpoint.snapshots) {
    return { restored: false, reason: 'checkpoint missing' };
  }
  for (const [file, snapshot] of Object.entries(checkpoint.snapshots)) {
    const target = repoPath(repoRoot, file);
    if (snapshot.existed) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, snapshot.content || '');
    } else {
      fs.rmSync(target, { force: true });
    }
  }
  checkpoint.status = 'ROLLED_BACK';
  checkpoint.rolledBackAt = new Date().toISOString();
  checkpoint.rollbackReason = String(reason || '').slice(0, 200);
  writeJson(checkpointPath(repoRoot, checkpointId), checkpoint);
  removeLock(repoRoot, checkpointId);
  return { restored: true, checkpoint };
}

function recoverInterruptedExecution(root, { now = new Date(), maxAgeMs = DEFAULT_STALE_MS } = {}) {
  const repoRoot = path.resolve(root || process.cwd());
  const lock = readLock(repoRoot);
  if (!lock || lock.status !== 'IN_PROGRESS') return { recovered: [] };
  const age = new Date(now).getTime() - Date.parse(lock.createdAt || 0);
  if (age < maxAgeMs) return { recovered: [] };
  const restored = restoreCheckpoint(repoRoot, lock.checkpointId || lock.executionId, 'interrupted run recovery');
  return { recovered: restored.restored ? [restored.checkpoint] : [] };
}

function cleanupStaleLocks(root, { now = new Date(), maxAgeMs = DEFAULT_STALE_MS } = {}) {
  const repoRoot = path.resolve(root || process.cwd());
  const lock = readLock(repoRoot);
  if (!lock) return { cleaned: 0 };
  const age = new Date(now).getTime() - Date.parse(lock.createdAt || 0);
  if (age < maxAgeMs) return { cleaned: 0 };
  recoverInterruptedExecution(repoRoot, { now, maxAgeMs });
  return { cleaned: 1 };
}

function checkpointPath(root, id) {
  return path.join(root, CHECKPOINT_DIR, `${safeName(id)}.json`);
}

function readLock(root) {
  return readJson(path.join(root, LOCK_FILE), null);
}

function removeLock(root, checkpointId) {
  const lock = readLock(root);
  if (!lock || lock.checkpointId === checkpointId || lock.executionId === checkpointId) {
    fs.rmSync(path.join(root, LOCK_FILE), { force: true });
  }
}

function repoPath(root, relativePath) {
  const resolved = path.resolve(root, normalizePath(relativePath));
  const repoRoot = path.resolve(root);
  if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
    throw new Error(`Refusing path outside repo: ${relativePath}`);
  }
  return resolved;
}

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function safeName(value) {
  return String(value || 'checkpoint').replace(/[^a-z0-9_.-]/gi, '-').slice(0, 80);
}

function array(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

module.exports = {
  beginExecutionCheckpoint,
  completeExecutionCheckpoint,
  restoreCheckpoint,
  recoverInterruptedExecution,
  cleanupStaleLocks
};
