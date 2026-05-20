const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TASK_FILE = path.join(ROOT, 'ai-cto', 'tasks.json');
const MAX_TASKS = 50;
const STALE_DONE_DAYS = 30;

const VALID_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE']);
const VALID_OWNERS = new Set(['cto', 'coder', 'reviewer', 'auditor']);
const VALID_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const DEFAULT_TASK_STATE = {
  version: '1.0',
  updated_at: null,
  tasks: []
};

function readTaskState() {
  try {
    if (!fs.existsSync(TASK_FILE)) return writeTaskState(DEFAULT_TASK_STATE);
    const parsed = JSON.parse(fs.readFileSync(TASK_FILE, 'utf8'));
    return normalizeTaskState(parsed);
  } catch (error) {
    recoverCorruptTaskState(error);
    return writeTaskState(DEFAULT_TASK_STATE);
  }
}

function writeTaskState(state) {
  const normalized = normalizeTaskState(state);
  normalized.updated_at = new Date().toISOString();
  const tmp = `${TASK_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2));
  fs.renameSync(tmp, TASK_FILE);
  return normalized;
}

function normalizeTaskState(state) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const seen = new Set();
  const normalizedTasks = [];

  for (const rawTask of tasks) {
    const task = normalizeTask(rawTask);
    const key = duplicateKey(task);
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedTasks.push(task);
    if (normalizedTasks.length >= MAX_TASKS) break;
  }

  return {
    version: '1.0',
    updated_at: state.updated_at || null,
    tasks: cleanupStaleTasks(normalizedTasks)
  };
}

function normalizeTask(task) {
  const now = new Date().toISOString();
  const status = String(task.status || 'OPEN').toUpperCase();
  const owner = String(task.owner || 'cto').toLowerCase();
  const severity = String(task.severity || 'MEDIUM').toUpperCase();

  return {
    id: String(task.id || '').trim() || nextTaskId([]),
    title: String(task.title || 'Untitled task').trim().slice(0, 180),
    severity: VALID_SEVERITIES.has(severity) ? severity : 'MEDIUM',
    owner: VALID_OWNERS.has(owner) ? owner : 'cto',
    status: VALID_STATUSES.has(status) ? status : 'OPEN',
    created_at: task.created_at || now,
    updated_at: task.updated_at || now,
    notes: Array.isArray(task.notes) ? task.notes.map((note) => String(note).slice(0, 240)).slice(0, 10) : [],
    blocked_reason: task.blocked_reason ? String(task.blocked_reason).slice(0, 240) : null
  };
}

function cleanupStaleTasks(tasks) {
  const cutoff = Date.now() - STALE_DONE_DAYS * 24 * 60 * 60 * 1000;
  return tasks.filter((task) => {
    if (task.status !== 'DONE') return true;
    const updatedAt = Date.parse(task.updated_at);
    return !Number.isFinite(updatedAt) || updatedAt >= cutoff;
  });
}

function recoverCorruptTaskState(error) {
  try {
    if (!fs.existsSync(TASK_FILE)) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(TASK_FILE, `${TASK_FILE}.corrupt-${timestamp}`);
    fs.writeFileSync(TASK_FILE, JSON.stringify({
      ...DEFAULT_TASK_STATE,
      updated_at: new Date().toISOString(),
      recovery_reason: `Invalid JSON: ${error.message}`
    }, null, 2));
  } catch {
    // Task recovery must not block WhatsApp responses.
  }
}

function duplicateKey(task) {
  return `${task.title.toLowerCase()}|${task.owner}|${task.severity}`;
}

function nextTaskId(tasks) {
  const max = tasks.reduce((highest, task) => {
    const match = String(task.id || '').match(/TASK-(\d+)/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `TASK-${String(max + 1).padStart(4, '0')}`;
}

module.exports = {
  TASK_FILE,
  MAX_TASKS,
  VALID_STATUSES,
  readTaskState,
  writeTaskState,
  normalizeTaskState,
  duplicateKey,
  nextTaskId
};
