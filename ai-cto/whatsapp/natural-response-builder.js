const { getPersonality } = require('./personality-router');
const { summarizeTasksForAgent } = require('./task-manager');
const { maintenanceSnapshot } = require('./maintenance-reader');
const { executionSnapshot } = require('./execution-reader');
const { generatePassiveWorkerUpdates } = require('./humanized-summary-generator');
const { enforcePersonalityGuardrails } = require('./personality-guard');

function buildNaturalResponse({ agent, intent, topic, state, memory = {} }) {
  const safeState = normalizeState(state);
  const persona = getPersonality(agent);
  const tasks = summarizeTasksForAgent(agent);
  const maintenance = maintenanceSnapshot();
  const execution = executionSnapshot();
  const context = { persona, tasks, maintenance, execution, topic, intent, state: safeState, memory };
  const lines = [
    `[${persona.label}]`,
    persona.opener,
    ...agentLines(agent, context)
  ];

  return enforcePersonalityGuardrails(limitResponse(lines));
}

function agentLines(agent, context) {
  if (agent === 'coder') return coderLines(context);
  if (agent === 'reviewer') return reviewerLines(context);
  if (agent === 'auditor') return auditorLines(context);
  return ctoLines(context);
}

function ctoLines({ state, topic, memory, tasks, execution, intent }) {
  const next = topic || first(state.sections.nextPriority) || memory.lastActiveTask || 'monitoring stability';
  const activeCount = tasks.totalActive || 0;
  const lines = [
    `Sir, current health is ${formatHealth(state)} with momentum ${state.momentum || 'UNKNOWN'}.`,
    activeCount > 0
      ? `${activeCount} active task(s) are moving; I am keeping the risky parts behind review.`
      : 'No critical task is actively moving right now; I am keeping the system in watch mode.',
    `Direction: ${compact(next)}.`
  ];

  const passive = generatePassiveWorkerUpdates(state, { execution }).slice(0, 2);
  if (intent === 'execution') {
    lines.push(`Safe execution: ${execution.dryRun.length} dry-run, ${execution.completed.length} completed, ${execution.blocked.length} blocked.`);
  }
  if (passive.length) lines.push('', ...passive);
  return lines;
}

function coderLines({ state, topic, memory, tasks, maintenance, execution, intent }) {
  const focus = topic || memory.lastActiveTask || first(state.sections.nextPriority) || 'the next safe maintenance item';
  const latestFix = memory.latestImprovement || first(state.sections.completedFixes);
  const ownedTask = first(tasks.owned);
  const dryRun = first(execution.dryRun);
  const completedExecution = first(execution.completed);
  const lines = [
    `Sir, I am looking at ${compact(focus)}.`,
    latestFix
      ? `Last recorded improvement: ${compact(latestFix)}.`
      : 'No completed coding fix is recorded in the latest state.',
    ownedTask
      ? `My assigned item is still ${compact(ownedTask.title || ownedTask.id || ownedTask)}.`
      : 'No coder-owned task is assigned right now.',
  ];

  if (completedExecution) {
    lines.push(`Execution log says ${completedExecution.action} completed with rollback noted.`);
  } else if (dryRun) {
    lines.push(`I paused at dry-run on ${dryRun.action}; no risky execution done.`);
  } else if (intent === 'execution') {
    lines.push('No approved safe execution action is recorded for me right now.');
  } else if (intent === 'maintenance') {
    const maintenanceItem = first(maintenance.executed) || first(maintenance.dryRun);
    lines.push(maintenanceItem
      ? `Maintenance log shows ${maintenanceItem.action}; I am not claiming more than that.`
      : 'Maintenance is still dry-run/reporting only from my side.');
  }

  return lines;
}

function reviewerLines({ state, topic, memory, tasks, execution }) {
  const warning = memory.latestWarning || first(state.sections.risks) || first(state.sections.unresolved);
  const blocked = first(tasks.blocked) || first(execution.blocked) || first(execution.rolledBack);
  const lines = [
    topic
      ? `Sir, I checked ${compact(topic)} from a regression angle.`
      : 'Sir, I checked the latest state from a regression angle.',
    warning
      ? `Main concern: ${compact(warning)}.`
      : 'No fresh regression concern is recorded right now.',
    blocked
      ? `I am holding this until ${compact(blocked.blocked_reason || blocked.title || blocked.action || blocked)} is clear.`
      : 'Nothing is blocked by reviewer right now.'
  ];

  const failedValidation = state.validation.find((item) => String(item.status || '').toLowerCase() === 'failed');
  if (failedValidation) lines.push(`${failedValidation.task} is still failing, so I would not call this stable yet.`);
  return lines;
}

function auditorLines({ state, topic, memory, execution }) {
  const danger = findDanger(state) || memory.latestWarning || memory.latestUnresolvedIssue;
  const blocked = first(execution.blocked) || first(execution.rolledBack);
  const lines = [
    topic
      ? `Sir, danger check on ${compact(topic)}.`
      : 'Sir, danger check only.',
    danger
      ? `Still dangerous: ${compact(danger)}.`
      : 'No dangerous issue is recorded in the latest state.',
    blocked
      ? `Blocked execution: ${blocked.action}. Rollback/scope was not safe enough.`
      : 'No dangerous execution attempt is active.'
  ];
  return lines;
}

function findDanger(state) {
  return state.sections.unresolved
    .concat(state.sections.risks)
    .find((item) => /secret|unsafe|danger|critical|security|privacy|oversized|stale/i.test(item));
}

function normalizeState(state = {}) {
  return {
    ...state,
    validation: Array.isArray(state.validation) ? state.validation : [],
    sections: {
      risks: [],
      unresolved: [],
      repeatedFailures: [],
      unstableFiles: [],
      completedFixes: [],
      approvals: [],
      nextPriority: [],
      safestOpportunity: [],
      ...(state.sections || {})
    },
    changed: {
      completed: [],
      newRisks: [],
      ...(state.changed || {})
    },
    summary: {
      nextPriority: 'No priority recorded yet.',
      topRisk: 'No top risk recorded yet.',
      ...(state.summary || {})
    }
  };
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function compact(value, max = 150) {
  const raw = String(value || '');
  const withoutSeverity = /^\[Aritenis [^\]]+\]/.test(raw) ? raw : raw.replace(/^\[[^\]]+\]\s*/, '');
  const text = withoutSeverity.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatHealth(state) {
  return state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
}

function limitResponse(lines) {
  const cleaned = lines
    .filter(Boolean)
    .map((line) => compact(line, 180))
    .slice(0, 8)
    .join('\n');
  return cleaned.length > 900 ? `${cleaned.slice(0, 897)}...` : cleaned;
}

module.exports = {
  buildNaturalResponse,
  compact,
  normalizeState
};
