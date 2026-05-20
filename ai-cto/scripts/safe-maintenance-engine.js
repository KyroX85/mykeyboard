const fs = require('fs');
const path = require('path');

const root = process.cwd();
const apply = process.argv.includes('--apply');
const maxActions = Number(process.env.SAFE_MAINTENANCE_MAX_ACTIONS || 5);
const actionsFile = path.join(root, 'ai-cto', 'maintenance-actions.json');
const tasksFile = path.join(root, 'ai-cto', 'tasks.json');

const forbiddenPathPatterns = [
  /^\.github\//,
  /^app\/src\/main\/java\//,
  /^app\/src\/main\/kotlin\//,
  /^app\/build\.gradle/,
  /^build\.gradle/,
  /^settings\.gradle/,
  /^gradle\//,
  /^package\.json$/
];

const allowedDocFiles = new Set(['README.md', 'NEXT.md', 'CTO_SIMPLIFICATION_REPORT.md', 'TASK_PIPELINE_REPORT.md']);
const generatedArtifacts = new Set([
  'ai-cto/autofix-summary.json',
  'ai-cto/validation-results.json',
  'test_output.log'
]);

const executable = [];
const skipped = [];
const blocked = [];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function safetyCheck(action) {
  if (!action.rollback_method) return { ok: false, reason: 'Missing rollback method.' };
  if (action.risk !== 'LOW') return { ok: false, reason: 'Only LOW risk actions are executable.' };
  if (action.file && forbiddenPathPatterns.some((pattern) => pattern.test(action.file))) {
    return { ok: false, reason: `Forbidden path scope: ${action.file}` };
  }
  if (/kotlin|prediction|keyboard behavior|routing|persistence|telemetry|lifecycle|networking|workflow|dependency/i.test(action.reason)) {
    return { ok: false, reason: 'Forbidden domain keyword detected.' };
  }
  return { ok: true };
}

function recordOpportunity(action) {
  const checked = safetyCheck(action);
  if (!checked.ok) {
    blocked.push({ ...action, result: 'BLOCKED', blocked_reason: checked.reason });
    return;
  }
  if (executable.length >= maxActions) {
    skipped.push({ ...action, result: 'SKIPPED', skipped_reason: 'Max actions per run reached.' });
    return;
  }
  executable.push(action);
}

function scanDocumentationCleanup() {
  for (const name of allowedDocFiles) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    const cleaned = original
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n*$/g, '\n');
    if (cleaned === original) continue;
    recordOpportunity({
      action: 'documentation-cleanup',
      file: name,
      reason: 'Trim trailing whitespace and normalize final newline in documentation.',
      risk: 'LOW',
      timestamp: new Date().toISOString(),
      rollback_method: `git checkout -- ${name}`,
      result: apply ? 'PENDING' : 'DRY_RUN'
    });
  }
}

function scanGeneratedArtifactCleanup() {
  for (const artifact of generatedArtifacts) {
    const file = path.join(root, artifact);
    if (!fs.existsSync(file)) continue;
    recordOpportunity({
      action: 'generated-artifact-cleanup',
      file: artifact,
      reason: 'Remove generated local artifact that is not required for source behavior.',
      risk: 'LOW',
      timestamp: new Date().toISOString(),
      rollback_method: `git checkout -- ${artifact} if tracked, otherwise regenerate via CTO scripts.`,
      result: apply ? 'PENDING' : 'DRY_RUN'
    });
  }
}

function scanStaleTaskCleanup() {
  const state = readJson(tasksFile, null);
  if (!state || !Array.isArray(state.tasks)) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleDone = state.tasks.filter((task) => {
    if (task.status !== 'DONE') return false;
    const updated = Date.parse(task.updated_at);
    return Number.isFinite(updated) && updated < cutoff;
  });
  if (staleDone.length === 0) return;
  recordOpportunity({
    action: 'stale-task-cleanup',
    file: 'ai-cto/tasks.json',
    reason: `Remove ${staleDone.length} DONE task(s) older than 30 days.`,
    risk: 'LOW',
    timestamp: new Date().toISOString(),
    rollback_method: 'git checkout -- ai-cto/tasks.json',
    result: apply ? 'PENDING' : 'DRY_RUN',
    meta: { stale_task_ids: staleDone.map((task) => task.id) }
  });
}

function scanDeadResourceSuggestions() {
  const resRoot = path.join(root, 'app', 'src', 'main', 'res');
  if (!fs.existsSync(resRoot)) return;
  blocked.push({
    action: 'dead-resource-removal-suggestion',
    file: 'app/src/main/res',
    reason: 'Dead Android resource removal requires full Android resource reference analysis and is not executable in Phase 1.',
    risk: 'HIGH',
    timestamp: new Date().toISOString(),
    rollback_method: 'No action executed.',
    result: 'BLOCKED',
    blocked_reason: 'HIGH risk suggestion only.'
  });
}

function execute(action) {
  if (!apply) return { ...action, result: 'DRY_RUN' };
  if (action.action === 'documentation-cleanup') {
    const file = path.join(root, action.file);
    const original = fs.readFileSync(file, 'utf8');
    const cleaned = original
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n*$/g, '\n');
    fs.writeFileSync(file, cleaned);
    return { ...action, result: 'EXECUTED' };
  }
  if (action.action === 'generated-artifact-cleanup') {
    const file = path.join(root, action.file);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { ...action, result: 'EXECUTED' };
  }
  if (action.action === 'stale-task-cleanup') {
    const state = readJson(tasksFile, { version: '1.0', tasks: [] });
    const staleIds = new Set((action.meta && action.meta.stale_task_ids) || []);
    state.tasks = state.tasks.filter((task) => !staleIds.has(task.id));
    state.updated_at = new Date().toISOString();
    writeJson(tasksFile, state);
    return { ...action, result: 'EXECUTED' };
  }
  return { ...action, result: 'SKIPPED', skipped_reason: 'No executor registered.' };
}

function appendActions(entries) {
  const existing = readJson(actionsFile, { version: '1.0', actions: [] });
  const next = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    actions: [...(Array.isArray(existing.actions) ? existing.actions : []), ...entries].slice(-200)
  };
  writeJson(actionsFile, next);
  return next;
}

function main() {
  scanDocumentationCleanup();
  scanGeneratedArtifactCleanup();
  scanStaleTaskCleanup();
  scanDeadResourceSuggestions();

  const executed = executable.map(execute);
  const all = [...executed, ...skipped, ...blocked];
  appendActions(all);

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    executable: executed.length,
    skipped: skipped.length,
    blocked: blocked.length
  };
  console.log(`[safe-maintenance] ${JSON.stringify(summary)}`);
}

if (require.main === module) main();

module.exports = {
  safetyCheck,
  scanDocumentationCleanup,
  scanGeneratedArtifactCleanup,
  scanStaleTaskCleanup,
  scanDeadResourceSuggestions,
  execute,
  main
};
