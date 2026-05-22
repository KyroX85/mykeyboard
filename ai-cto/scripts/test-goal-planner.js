const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  readGoals,
  flattenGoals,
  classifyGoalExecution,
  buildGoalPlan
} = require('./goal-planner');
const { runAutonomousWorkLoop } = require('./autonomous-work-loop');

const repoRoot = path.resolve(__dirname, '..', '..');
const goals = readGoals(repoRoot);

assert(goals.north_star.includes('By May 2027'));
assert(goals.vision_summary.includes('Android keyboard'));
assert.strictEqual(goals.phases.length, 4);
assert(goals.global_rules.includes('Never skip phases.'));

const flat = flattenGoals(goals);
assert(flat.length >= 10);
assert(flat.some((goal) => goal.id === 'stab-001-live-validation'));
assert(flat.some((goal) => goal.id === 'ai-001-on-device-sample-store' && goal.status === 'LOCKED_UNTIL_PHASE'));

const low = classifyGoalExecution({ title: 'Docs cleanup', risk: 'LOW', allowed_actions: ['documentation_cleanup'] }, goals);
assert.strictEqual(low.canAutonomouslyExecute, true);
assert.strictEqual(low.mode, 'AUTO_EXECUTE_AFTER_VALIDATION');

const high = classifyGoalExecution({ title: 'Privacy dashboard', risk: 'HIGH', allowed_actions: ['privacy'] }, goals);
assert.strictEqual(high.canAutonomouslyExecute, false);
assert.strictEqual(high.mode, 'FOUNDER_OPTIONS_ONLY');

const plan = buildGoalPlan({
  root: repoRoot,
  state: {
    healthScore: 25,
    unresolvedIssues: [{ type: 'SECURITY', file: 'chaos_test.js' }]
  }
});

assert.strictEqual(plan.active_phase.id, 'phase-1-stabilization');
assert(plan.selected_goals.length <= 3);
assert(plan.selected_goals.some((goal) => goal.id.startsWith('stab-')));
assert(plan.selected_goals.every((goal) => !goal.id.startsWith('ai-')));
assert(plan.blocked_future_goals.some((goal) => goal.id.startsWith('ai-')));
assert(plan.stop_conditions.includes('forbidden scope detected'));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-goal-loop-'));
try {
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'ai-cto', 'goals.json'), path.join(tempRoot, 'ai-cto', 'goals.json'));
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', '.brain_state.json'), JSON.stringify({
    healthScore: 80,
    unresolvedIssues: []
  }, null, 2));
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'agent-action-log.json'), JSON.stringify({ actions: [] }, null, 2));

  const dryRun = runAutonomousWorkLoop({
    root: tempRoot,
    execute: false,
    maxActions: 3,
    state: { healthScore: 80, unresolvedIssues: [] }
  });

  assert.strictEqual(dryRun.status, 'DRY_RUN');
  assert.strictEqual(dryRun.cycle.mode, 'DRY_RUN');
  assert(dryRun.cycle.selected_goal_ids.length <= 3);
  assert.strictEqual(dryRun.cycle.executed.length, 0);
  assert(fs.existsSync(path.join(tempRoot, 'ai-cto', 'autonomous-work-log.json')));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Goal planner checks passed.');
