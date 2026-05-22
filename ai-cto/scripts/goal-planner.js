const fs = require('fs');
const path = require('path');
const { readBrainState } = require('./execution-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const GOALS_FILE = path.join(ROOT, 'ai-cto', 'goals.json');

const PRIORITY_WEIGHT = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25
};

const RISK_EXECUTION = {
  LOW: 'AUTO_EXECUTE_AFTER_VALIDATION',
  MEDIUM: 'STAGING_BRANCH_AND_FOUNDER_APPROVAL',
  HIGH: 'FOUNDER_OPTIONS_ONLY'
};

function readGoals(root = ROOT) {
  const file = path.join(root, 'ai-cto', 'goals.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    ...parsed,
    phases: Array.isArray(parsed.phases) ? parsed.phases : []
  };
}

function flattenGoals(goalState) {
  const phases = Array.isArray(goalState.phases) ? goalState.phases : [];
  return phases.flatMap((phase, phaseIndex) =>
    (Array.isArray(phase.goals) ? phase.goals : []).map((goal) => ({
      ...goal,
      phase_id: phase.id,
      phase_name: phase.name,
      phase_index: phaseIndex,
      phase_goal: phase.goal,
      phase_window: phase.window
    }))
  );
}

function activePhase(goalState, options = {}) {
  if (options.currentPhaseId) {
    return goalState.phases.find((phase) => phase.id === options.currentPhaseId) || goalState.phases[0];
  }
  return goalState.phases.find((phase) => /^phase-1/i.test(phase.id)) || goalState.phases[0] || null;
}

function classifyGoalExecution(goal, goalState) {
  const risk = String(goal.risk || 'MEDIUM').toUpperCase();
  const forbiddenScopes = goalState.forbidden_autonomous_scopes || [];
  const text = [
    goal.title,
    goal.product_impact,
    ...(goal.allowed_actions || [])
  ].join(' ').toLowerCase();
  const forbidden = forbiddenScopes.find((scope) => text.includes(String(scope).replace(/_/g, ' ')) || text.includes(String(scope)));

  if (forbidden || risk === 'HIGH') {
    return {
      risk,
      mode: 'FOUNDER_OPTIONS_ONLY',
      canAutonomouslyExecute: false,
      reason: forbidden ? `Touches forbidden scope: ${forbidden}` : 'High-risk goal requires founder decision.'
    };
  }

  if (risk === 'MEDIUM') {
    return {
      risk,
      mode: RISK_EXECUTION.MEDIUM,
      canAutonomouslyExecute: false,
      reason: 'Medium-risk goal needs staging branch and founder approval.'
    };
  }

  return {
    risk: 'LOW',
    mode: RISK_EXECUTION.LOW,
    canAutonomouslyExecute: true,
    reason: 'Low-risk maintenance can run after validation and rollback check.'
  };
}

function scoreGoal(goal, state = {}) {
  const priority = PRIORITY_WEIGHT[String(goal.priority || 'MEDIUM').toUpperCase()] || 40;
  const phaseBoost = goal.status === 'ACTIVE' ? 30 : -100;
  const riskBoost = goal.risk === 'LOW' ? 10 : goal.risk === 'MEDIUM' ? 3 : -10;
  const healthScore = Number(state.healthScore);
  const healthPressure = Number.isFinite(healthScore) && healthScore < 60 && /validation|risk|stability|health|crash/i.test(`${goal.title} ${goal.product_impact}`)
    ? 15
    : 0;
  return priority + phaseBoost + riskBoost + healthPressure;
}

function buildGoalPlan(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const maxItems = Math.min(Math.max(Number(options.maxItems || 3), 1), 3);
  const goalState = readGoals(root);
  const state = options.state || readBrainState(root);
  const phase = activePhase(goalState, options);
  const allGoals = flattenGoals(goalState);
  const activeGoals = allGoals
    .filter((goal) => phase && goal.phase_id === phase.id)
    .filter((goal) => goal.status === 'ACTIVE')
    .map((goal) => {
      const execution = classifyGoalExecution(goal, goalState);
      return {
        ...goal,
        score: scoreGoal(goal, state),
        execution
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, maxItems);

  return {
    generated_at: new Date().toISOString(),
    north_star: goalState.north_star,
    active_phase: phase ? {
      id: phase.id,
      name: phase.name,
      window: phase.window,
      goal: phase.goal
    } : null,
    selected_goals: activeGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      owner: goal.owner,
      priority: goal.priority,
      risk: goal.risk,
      execution_mode: goal.execution.mode,
      can_autonomously_execute: goal.execution.canAutonomouslyExecute,
      reason: goal.execution.reason,
      success_metric: goal.success_metric,
      product_impact: goal.product_impact,
      next_action: nextAction(goal)
    })),
    blocked_future_goals: allGoals
      .filter((goal) => goal.status === 'LOCKED_UNTIL_PHASE')
      .slice(0, 5)
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        phase: goal.phase_name,
        reason: 'Locked until founder-approved phase transition.'
      })),
    stop_conditions: [
      'health score below 20',
      'validation failure after one attempt',
      'same action fails twice',
      'forbidden scope detected',
      'more than 3 autonomous actions requested in one cycle'
    ]
  };
}

function nextAction(goal) {
  if (goal.risk === 'LOW') return `Run validation, then execute only safe ${first(goal.allowed_actions)} work if available.`;
  if (goal.risk === 'MEDIUM') return 'Prepare staging-branch proposal and ask founder before merge.';
  return 'Send founder three options; do not execute autonomously.';
}

function first(items) {
  return Array.isArray(items) && items.length ? items[0] : 'maintenance';
}

function formatGoalPlan(plan) {
  const lines = [
    'GOAL-ORIENTED CTO PLAN',
    `North star: ${plan.north_star}`,
    `Active phase: ${plan.active_phase ? `${plan.active_phase.name} (${plan.active_phase.window})` : 'none'}`,
    '',
    'Selected work'
  ];

  for (const goal of plan.selected_goals) {
    lines.push(`- ${goal.id}: ${goal.title}`);
    lines.push(`  Owner: ${goal.owner}; Risk: ${goal.risk}; Mode: ${goal.execution_mode}`);
    lines.push(`  Metric: ${goal.success_metric}`);
    lines.push(`  Next: ${goal.next_action}`);
  }

  lines.push('', 'Locked future goals');
  for (const goal of plan.blocked_future_goals) {
    lines.push(`- ${goal.id}: ${goal.title} (${goal.reason})`);
  }

  return lines.join('\n');
}

if (require.main === module) {
  const plan = buildGoalPlan();
  process.stdout.write(formatGoalPlan(plan) + '\n');
}

module.exports = {
  GOALS_FILE,
  readGoals,
  flattenGoals,
  activePhase,
  classifyGoalExecution,
  buildGoalPlan,
  formatGoalPlan
};
