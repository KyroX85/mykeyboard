const {
  readTaskState,
  writeTaskState,
  duplicateKey,
  nextTaskId
} = require('./task-memory');

function getTaskSnapshot() {
  const state = readTaskState();
  return {
    ...state,
    active: state.tasks.filter((task) => task.status !== 'DONE'),
    blocked: state.tasks.filter((task) => task.status === 'BLOCKED'),
    review: state.tasks.filter((task) => task.status === 'REVIEW'),
    done: state.tasks.filter((task) => task.status === 'DONE')
  };
}

function createTask(input) {
  const state = readTaskState();
  const task = {
    id: nextTaskId(state.tasks),
    title: input.title,
    severity: input.severity || 'MEDIUM',
    owner: input.owner || 'cto',
    status: input.status || 'OPEN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: Array.isArray(input.notes) ? input.notes : [],
    blocked_reason: input.blocked_reason || null
  };

  const key = duplicateKey(task);
  const existing = state.tasks.find((candidate) => duplicateKey(candidate) === key);
  if (existing) {
    return { created: false, task: existing, reason: 'duplicate' };
  }

  const next = writeTaskState({ ...state, tasks: [...state.tasks, task] });
  return { created: true, task: next.tasks.find((candidate) => candidate.id === task.id) };
}

function summarizeTasksForAgent(agent) {
  const snapshot = getTaskSnapshot();
  const owned = snapshot.active.filter((task) => task.owner === agent);
  const critical = snapshot.active.filter((task) => task.severity === 'CRITICAL');

  return {
    totalActive: snapshot.active.length,
    blocked: snapshot.blocked,
    owned,
    critical,
    next: owned[0] || snapshot.active[0] || null
  };
}

function formatTaskList(tasks, fallback) {
  if (!tasks || tasks.length === 0) return [`\u2022 ${fallback}`];
  return tasks.slice(0, 5).map((task) => {
    const blocked = task.status === 'BLOCKED' && task.blocked_reason ? ` blocked: ${task.blocked_reason}` : '';
    return `\u2022 ${task.id} [${task.severity}/${task.status}] ${task.title}${blocked}`;
  });
}

function detectStaleTasks(now = Date.now(), days = 14) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return getTaskSnapshot().active.filter((task) => {
    const updatedAt = Date.parse(task.updated_at);
    return Number.isFinite(updatedAt) && updatedAt < cutoff;
  });
}

module.exports = {
  getTaskSnapshot,
  createTask,
  summarizeTasksForAgent,
  formatTaskList,
  detectStaleTasks
};
