const fs = require('fs');
const path = require('path');
const { buildGoalPlan, formatGoalPlan } = require('./goal-planner');
const { executeFirstFixableIssue, readActionLog } = require('./execution-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const LOOP_LOG = path.join(ROOT, 'ai-cto', 'autonomous-work-log.json');
const MAX_ACTIONS_PER_CYCLE = 3;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function appendLoopLog(root, entry) {
  const file = path.join(root, 'ai-cto', 'autonomous-work-log.json');
  const log = readJson(file, { cycles: [] });
  log.cycles = Array.isArray(log.cycles) ? log.cycles : [];
  log.cycles.push(entry);
  writeJson(file, log);
}

function runAutonomousWorkLoop(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const execute = options.execute === true;
  const push = options.push === true;
  const maxActions = Math.min(Math.max(Number(options.maxActions || MAX_ACTIONS_PER_CYCLE), 1), MAX_ACTIONS_PER_CYCLE);
  const plan = buildGoalPlan({ root, maxItems: maxActions, state: options.state });
  const executable = plan.selected_goals.filter((goal) => goal.can_autonomously_execute).slice(0, maxActions);
  const cycle = {
    timestamp: new Date().toISOString(),
    mode: execute ? 'EXECUTE_LOW_RISK' : 'DRY_RUN',
    selected_goal_ids: plan.selected_goals.map((goal) => goal.id),
    executed: [],
    skipped: [],
    founder_required: []
  };

  for (const goal of plan.selected_goals) {
    if (!goal.can_autonomously_execute) {
      cycle.founder_required.push({
        goal_id: goal.id,
        title: goal.title,
        risk: goal.risk,
        reason: goal.reason
      });
    }
  }

  if (!execute) {
    cycle.skipped.push({
      reason: 'Dry-run mode. No files changed.',
      executable_goal_ids: executable.map((goal) => goal.id)
    });
    appendLoopLog(root, cycle);
    return { status: 'DRY_RUN', plan, cycle, actionLog: readActionLog(root) };
  }

  for (const goal of executable) {
    const result = executeFirstFixableIssue({
      root,
      commit: options.commit !== false,
      push,
      validationCommand: options.validationCommand
    });
    cycle.executed.push({
      goal_id: goal.id,
      title: goal.title,
      result
    });
    if (result.status !== 'COMPLETED' && result.status !== 'NO_CHANGE') break;
  }

  appendLoopLog(root, cycle);
  return { status: 'COMPLETED', plan, cycle, actionLog: readActionLog(root) };
}

function formatLoopResult(result) {
  return [
    formatGoalPlan(result.plan),
    '',
    `Loop mode: ${result.cycle.mode}`,
    `Executed: ${result.cycle.executed.length}`,
    `Founder required: ${result.cycle.founder_required.length}`,
    `Skipped: ${result.cycle.skipped.length}`
  ].join('\n');
}

if (require.main === module) {
  const result = runAutonomousWorkLoop({
    execute: process.argv.includes('--execute'),
    push: process.argv.includes('--push')
  });
  process.stdout.write(formatLoopResult(result) + '\n');
}

module.exports = {
  LOOP_LOG,
  runAutonomousWorkLoop,
  formatLoopResult
};
