const assert = require('assert');
const fs = require('fs');
const {
  TASK_FILE,
  readTaskState,
  writeTaskState,
  MAX_TASKS
} = require('../whatsapp/task-memory');
const {
  createTask,
  getTaskSnapshot,
  detectStaleTasks
} = require('../whatsapp/task-manager');

const original = fs.existsSync(TASK_FILE) ? fs.readFileSync(TASK_FILE, 'utf8') : null;

try {
  writeTaskState({
    version: '1.0',
    tasks: [
      {
        id: 'TASK-0001',
        title: 'Existing task',
        severity: 'HIGH',
        owner: 'cto',
        status: 'OPEN',
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-01T00:00:00.000Z',
        notes: [],
        blocked_reason: null
      }
    ]
  });

  const duplicate = createTask({
    title: 'Existing task',
    severity: 'HIGH',
    owner: 'cto'
  });
  assert.strictEqual(duplicate.created, false);
  assert.strictEqual(duplicate.reason, 'duplicate');

  const created = createTask({
    title: 'New reviewer task',
    severity: 'MEDIUM',
    owner: 'reviewer',
    status: 'REVIEW'
  });
  assert.strictEqual(created.created, true);

  const snapshot = getTaskSnapshot();
  assert(snapshot.active.length >= 2);
  assert(snapshot.review.some((task) => task.title === 'New reviewer task'));

  const stale = detectStaleTasks(Date.parse('2026-05-20T00:00:00.000Z'), 14);
  assert(stale.some((task) => task.title === 'Existing task'));

  fs.writeFileSync(TASK_FILE, '{ broken json');
  const recovered = readTaskState();
  assert(Array.isArray(recovered.tasks));

  const manyTasks = Array.from({ length: MAX_TASKS + 10 }, (_, index) => ({
    id: `TASK-${String(index + 1).padStart(4, '0')}`,
    title: `Task ${index}`,
    severity: 'LOW',
    owner: 'cto',
    status: 'OPEN',
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
    notes: [],
    blocked_reason: null
  }));
  writeTaskState({ version: '1.0', tasks: manyTasks });
  assert.strictEqual(readTaskState().tasks.length, MAX_TASKS);
} catch (error) {
  throw error;
} finally {
  if (original === null) {
    if (fs.existsSync(TASK_FILE)) fs.unlinkSync(TASK_FILE);
  } else {
    fs.writeFileSync(TASK_FILE, original);
  }
}

console.log('Task pipeline checks passed.');
