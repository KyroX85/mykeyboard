const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  EXECUTION_STATES,
  createExecutionPlan,
  detectDangerousScope,
  validateExecutionPlan,
  executePlan,
  executionSnapshot
} = require('./safe-execution-engine');

const root = process.cwd();
const logFile = path.join(root, 'ai-cto', 'execution-log.json');
const originalLog = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : null;

try {
  assert(EXECUTION_STATES.includes('PROPOSED'));
  assert(EXECUTION_STATES.includes('ROLLED_BACK'));

  const safePlan = createExecutionPlan({
    action: 'report-compression',
    reason: 'Compress stale report summary whitespace for mobile readability.',
    affected_files: ['SAFE_EXECUTION_POLICY.md'],
    validation_step: 'node ai-cto/scripts/test-safe-execution-engine.js',
    owning_agent: 'Coder',
    rollback_method: 'git checkout -- SAFE_EXECUTION_POLICY.md'
  });

  assert.strictEqual(safePlan.state, 'PROPOSED');
  assert.strictEqual(safePlan.risk_level, 'LOW');
  assert.strictEqual(validateExecutionPlan(safePlan).ok, true);

  const dangerous = createExecutionPlan({
    action: 'workflow-cleanup',
    reason: 'Modify workflow to add automation.',
    affected_files: ['.github/workflows/engineering-maintenance.yml'],
    validation_step: 'manual',
    owning_agent: 'Coder',
    rollback_method: 'git checkout -- .github/workflows/engineering-maintenance.yml'
  });
  assert.strictEqual(detectDangerousScope(dangerous).ok, false);
  assert.strictEqual(validateExecutionPlan(dangerous).ok, false);

  const malformed = {
    action: 'cleanup',
    reason: 'Missing rollback.',
    affected_files: ['README.md'],
    validation_step: 'manual',
    owning_agent: 'Coder'
  };
  assert.strictEqual(validateExecutionPlan(malformed).ok, false);

  const firstRun = executePlan(safePlan, {
    dryRun: true,
    now: new Date('2026-05-21T10:00:00.000Z')
  });
  assert.strictEqual(firstRun.state, 'APPROVED');
  assert.strictEqual(firstRun.result, 'DRY_RUN');

  const blockedRun = executePlan(dangerous, {
    dryRun: true,
    now: new Date('2026-05-21T10:01:00.000Z')
  });
  assert.strictEqual(blockedRun.state, 'BLOCKED');
  assert(blockedRun.blocked_reason.includes('Forbidden'));

  const cooldownRun = executePlan(safePlan, {
    dryRun: true,
    now: new Date('2026-05-21T10:02:00.000Z')
  });
  assert.strictEqual(cooldownRun.state, 'BLOCKED');
  assert(cooldownRun.blocked_reason.includes('Cooldown'));

  const rollbackRun = executePlan(safePlan, {
    dryRun: false,
    now: new Date('2026-05-21T10:30:00.000Z'),
    ignoreCooldown: true,
    cycleId: 'rollback-test'
  });
  assert.strictEqual(rollbackRun.state, 'ROLLED_BACK');
  assert.strictEqual(rollbackRun.result, 'ROLLBACK_REQUIRED');

  const loopResults = [];
  for (let index = 0; index < 8; index += 1) {
    loopResults.push(executePlan({
      ...safePlan,
      id: `loop-${index}`
    }, {
      dryRun: true,
      now: new Date(`2026-05-21T11:0${index}:00.000Z`),
      ignoreCooldown: true,
      maxActionsPerCycle: 3,
      cycleId: 'loop-test'
    }));
  }
  assert.strictEqual(loopResults.filter((entry) => entry.state === 'APPROVED').length, 3);
  assert(loopResults.some((entry) => String(entry.blocked_reason || '').includes('Max actions')));

  const snapshot = executionSnapshot();
  assert(snapshot.recent.length > 0);
  assert(snapshot.blocked.length > 0);
  assert(snapshot.dryRun.length > 0);

  console.log('Safe execution engine checks passed.');
} catch (error) {
  throw error;
} finally {
  if (originalLog === null) {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  } else {
    fs.writeFileSync(logFile, originalLog);
  }
}
