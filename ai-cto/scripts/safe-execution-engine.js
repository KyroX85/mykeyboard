const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LOG_FILE = path.join(ROOT, 'ai-cto', 'execution-log.json');

const EXECUTION_STATES = [
  'PROPOSED',
  'APPROVED',
  'EXECUTING',
  'COMPLETED',
  'BLOCKED',
  'ROLLED_BACK'
];

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ACTIONS_PER_CYCLE = Number(process.env.SAFE_EXECUTION_MAX_ACTIONS || 3);

const forbiddenPathPatterns = [
  /^\.github\//,
  /^app\/src\/main\/java\//,
  /^app\/src\/main\/kotlin\//,
  /^app\/build\.gradle/,
  /^build\.gradle/,
  /^settings\.gradle/,
  /^gradle\//,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^ai-cto\/brain\.js$/,
  /^ai-cto\/whatsapp-server\.js$/,
  /^ai-cto\/whatsapp\/state-reader\.js$/,
  /^ai-cto\/\.brain_state\.json$/,
  /^ai-cto\/tasks\.json$/
];

const forbiddenTextPattern = /workflow|gradle|dependency|package|network|telemetry|persistence|lifecycle|prediction|predictor|swipe|gesture|authentication|auth|secret|privacy|delete|remove file|kotlin logic|keyboard behavior/i;

const allowedActions = new Set([
  'documentation-cleanup',
  'dead-comment-cleanup',
  'formatting-normalization',
  'archive-suggestion-generation',
  'duplicate-task-cleanup',
  'outdated-log-rotation',
  'todo-organization',
  'report-compression',
  'stale-state-cleanup',
  'inactive-memory-cleanup'
]);

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function readExecutionLog() {
  const parsed = readJson(LOG_FILE, { version: '1.0', executions: [] });
  return {
    version: '1.0',
    updated_at: parsed.updated_at || null,
    executions: Array.isArray(parsed.executions) ? parsed.executions : []
  };
}

function appendExecution(entry) {
  const existing = readExecutionLog();
  const next = {
    version: '1.0',
    updated_at: entry.timestamp,
    executions: [...existing.executions, entry].slice(-250)
  };
  writeJson(LOG_FILE, next);
  return entry;
}

function createExecutionPlan(input = {}) {
  const timestamp = input.timestamp || new Date().toISOString();
  return {
    id: input.id || `exec-${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}-${safeSlug(input.action || 'action')}`,
    action: String(input.action || '').trim(),
    reason: String(input.reason || '').trim(),
    rollback_method: String(input.rollback_method || '').trim(),
    affected_files: Array.isArray(input.affected_files) ? input.affected_files.map(normalizePath) : [],
    risk_level: input.risk_level || 'LOW',
    validation_step: String(input.validation_step || '').trim(),
    timestamp,
    owning_agent: String(input.owning_agent || '').trim(),
    state: input.state || 'PROPOSED',
    cycle_id: input.cycle_id || null
  };
}

function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'action';
}

function detectDangerousScope(plan) {
  const files = Array.isArray(plan.affected_files) ? plan.affected_files.map(normalizePath) : [];
  const forbiddenFile = files.find((file) => forbiddenPathPatterns.some((pattern) => pattern.test(file)));
  if (forbiddenFile) {
    return { ok: false, reason: `Forbidden file scope: ${forbiddenFile}` };
  }

  const searchable = [plan.action, plan.reason, plan.rollback_method, plan.validation_step].join(' ');
  if (forbiddenTextPattern.test(searchable)) {
    return { ok: false, reason: 'Forbidden execution domain keyword detected.' };
  }

  return { ok: true };
}

function validateExecutionPlan(plan) {
  const required = ['action', 'reason', 'rollback_method', 'validation_step', 'owning_agent'];
  for (const field of required) {
    if (!plan[field] || !String(plan[field]).trim()) {
      return { ok: false, reason: `Missing required field: ${field}` };
    }
  }

  if (!Array.isArray(plan.affected_files) || plan.affected_files.length === 0) {
    return { ok: false, reason: 'affected_files must list at least one file.' };
  }

  if (plan.risk_level !== 'LOW') {
    return { ok: false, reason: 'Only LOW risk execution plans are allowed in Phase 1.' };
  }

  const scope = detectDangerousScope(plan);
  if (!scope.ok) return scope;

  if (!allowedActions.has(plan.action)) {
    return { ok: false, reason: `Action is not allowlisted: ${plan.action}` };
  }

  return { ok: true };
}

function cooldownCheck(now, cooldownMs) {
  const log = readExecutionLog();
  const recent = log.executions
    .filter((entry) => ['APPROVED', 'EXECUTING', 'COMPLETED'].includes(entry.state))
    .map((entry) => Date.parse(entry.timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (!recent) return { ok: true };
  const delta = now.getTime() - recent;
  if (delta < cooldownMs) {
    return { ok: false, reason: `Cooldown active for ${Math.ceil((cooldownMs - delta) / 1000)} more second(s).` };
  }
  return { ok: true };
}

function cycleLimitCheck(cycleId, maxActionsPerCycle) {
  const log = readExecutionLog();
  const approvedInCycle = log.executions.filter((entry) =>
    entry.cycle_id === cycleId && ['APPROVED', 'EXECUTING', 'COMPLETED'].includes(entry.state)
  );
  if (approvedInCycle.length >= maxActionsPerCycle) {
    return { ok: false, reason: `Max actions per cycle reached (${maxActionsPerCycle}).` };
  }
  return { ok: true };
}

function executePlan(inputPlan, options = {}) {
  const now = options.now || new Date();
  const timestamp = now.toISOString();
  const cycleId = options.cycleId || inputPlan.cycle_id || timestamp.slice(0, 10);
  const plan = createExecutionPlan({ ...inputPlan, timestamp, cycle_id: cycleId });
  const dryRun = options.dryRun !== false;
  const maxActionsPerCycle = options.maxActionsPerCycle || DEFAULT_MAX_ACTIONS_PER_CYCLE;
  const cooldownMs = options.cooldownMs == null ? DEFAULT_COOLDOWN_MS : options.cooldownMs;

  const validation = validateExecutionPlan(plan);
  if (!validation.ok) {
    return appendExecution({
      ...plan,
      state: 'BLOCKED',
      result: 'BLOCKED',
      blocked_reason: validation.reason
    });
  }

  const limit = cycleLimitCheck(cycleId, maxActionsPerCycle);
  if (!limit.ok) {
    return appendExecution({
      ...plan,
      state: 'BLOCKED',
      result: 'BLOCKED',
      blocked_reason: limit.reason
    });
  }

  if (!options.ignoreCooldown) {
    const cooldown = cooldownCheck(now, cooldownMs);
    if (!cooldown.ok) {
      return appendExecution({
        ...plan,
        state: 'BLOCKED',
        result: 'BLOCKED',
        blocked_reason: cooldown.reason
      });
    }
  }

  if (dryRun) {
    return appendExecution({
      ...plan,
      state: 'APPROVED',
      result: 'DRY_RUN'
    });
  }

  const executing = appendExecution({
    ...plan,
    state: 'EXECUTING',
    result: 'STARTED'
  });

  try {
    runExecutor(plan);
    return appendExecution({
      ...executing,
      timestamp: new Date().toISOString(),
      state: 'COMPLETED',
      result: 'EXECUTED'
    });
  } catch (error) {
    return appendExecution({
      ...executing,
      timestamp: new Date().toISOString(),
      state: 'ROLLED_BACK',
      result: 'ROLLBACK_REQUIRED',
      blocked_reason: error.message
    });
  }
}

function runExecutor(plan) {
  if (plan.action === 'documentation-cleanup' || plan.action === 'formatting-normalization') {
    for (const file of plan.affected_files) {
      const absolute = path.join(ROOT, file);
      if (!fs.existsSync(absolute)) continue;
      const original = fs.readFileSync(absolute, 'utf8');
      const cleaned = original
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+$/g, ''))
        .join('\n')
        .replace(/\n*$/g, '\n');
      fs.writeFileSync(absolute, cleaned);
    }
    return;
  }

  throw new Error(`No Phase 1 executor registered for ${plan.action}.`);
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

function main() {
  const plan = createExecutionPlan({
    action: 'report-compression',
    reason: 'Prepare a dry-run report compression proposal for CTO review.',
    affected_files: ['SAFE_EXECUTION_POLICY.md'],
    validation_step: 'node ai-cto/scripts/test-safe-execution-engine.js',
    owning_agent: 'CTO'
  });
  const result = executePlan(plan, { dryRun: !process.argv.includes('--apply') });
  console.log(`[safe-execution] ${JSON.stringify({ state: result.state, result: result.result })}`);
}

if (require.main === module) main();

module.exports = {
  EXECUTION_STATES,
  createExecutionPlan,
  detectDangerousScope,
  validateExecutionPlan,
  executePlan,
  executionSnapshot,
  readExecutionLog,
  main
};
