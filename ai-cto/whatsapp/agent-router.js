const { parseNaturalIntent } = require('./natural-intent-parser');
const { summarizeTasksForAgent, formatTaskList } = require('./task-manager');
const { maintenanceSnapshot, formatMaintenanceActions } = require('./maintenance-reader');
const { enforcePersonalityGuardrails } = require('./personality-guard');
const { logRoutingDecision } = require('./routing-debug');

const AGENTS = {
  cto: { label: 'Aritenis CTO', style: 'orchestration', greeting: 'Sir, CTO update' },
  coder: { label: 'Aritenis Coder', style: 'implementation', greeting: 'Sir, Coder side update' },
  reviewer: { label: 'Aritenis Reviewer', style: 'regression review', greeting: 'Sir, Reviewer note' },
  auditor: { label: 'Aritenis Auditor', style: 'safety audit', greeting: 'Sir, Auditor check' }
};

function routeAgentMessage(message, state, memory = {}) {
  const parsed = parseNaturalIntent(message, memory);
  if (!parsed.matched) {
    logRoutingDecision({
      incoming: message,
      normalized: parsed.normalized,
      detectedAgent: parsed.agent,
      intent: parsed.intent,
      confidence: parsed.confidence,
      matchedRoute: 'agent_miss',
      fallbackUsed: false
    });
    return null;
  }

  if (!parsed.agent && parsed.confidence < 0.5) {
    logRoutingDecision({
      incoming: message,
      normalized: parsed.normalized,
      detectedAgent: null,
      intent: parsed.intent,
      confidence: parsed.confidence,
      matchedRoute: 'agent_clarify',
      fallbackUsed: true,
      fallbackReason: 'low_confidence'
    });
    return {
      command: 'agent_clarify',
      agent: null,
      intent: parsed.intent,
      topic: parsed.topic,
      response: clarificationResponse()
    };
  }

  const agent = parsed.agent || 'cto';
  logRoutingDecision({
    incoming: message,
    normalized: parsed.normalized,
    detectedAgent: agent,
    intent: parsed.intent,
    confidence: parsed.confidence,
    matchedRoute: 'agent_intent',
    fallbackUsed: parsed.fallbackUsed,
    fallbackReason: parsed.fallbackReason
  });
  return {
    command: 'agent',
    agent,
    intent: parsed.intent,
    topic: parsed.topic,
    response: buildAgentResponse(agent, parsed.intent, parsed.topic, state, memory)
  };
}

function buildAgentResponse(agent, intent, topic, state, memory) {
  const builders = {
    cto: buildCtoResponse,
    coder: buildCoderResponse,
    reviewer: buildReviewerResponse,
    auditor: buildAuditorResponse
  };
  return (builders[agent] || buildCtoResponse)(intent, topic, state, memory);
}

function applyPersonality(agent, lines) {
  const profile = AGENTS[agent] || AGENTS.cto;
  return enforcePersonalityGuardrails([
    `[${profile.label}]`,
    profile.greeting,
    ...lines.filter(Boolean),
  ].join('\n'));
}

function clarificationResponse() {
  return [
    'Sir, which worker should answer?',
    'Try: CTO summary, coder progress, reviewer risks, auditor dangerous issues.'
  ].join('\n');
}

function buildCtoResponse(intent, topic, state, memory) {
  const tasks = summarizeTasksForAgent('cto');
  const lines = [
    `Sir, health ${formatHealth(state)} and momentum ${state.momentum || 'UNKNOWN'}.`,
    `Focus is ${topic || memory.currentSprintFocus || state.summary.nextPriority}.`,
    tasks.totalActive > 0
      ? `${tasks.totalActive} active task(s) running in pipeline.`
      : 'Nothing critical running right now sir. Mostly monitoring and waiting for the next safe cycle.',
    `Next sensible move: ${state.summary.nextPriority}`
  ];

  if (intent === 'approvals') {
    lines.push('', 'Pending approvals:', ...bullet(state.sections.approvals, 'No approval item pending sir.'));
  } else if (intent === 'risks') {
    lines.push('', 'Risk view:', ...bullet(state.sections.risks, 'No new critical risk recorded sir.'));
  } else if (intent === 'tasks' || intent === 'blocked_tasks') {
    const list = intent === 'blocked_tasks' ? tasks.blocked : tasks.owned.length ? tasks.owned : summarizeTasksForAgent('coder').owned;
    lines.push('', 'Task pipeline:', ...formatTaskList(list, 'No active CTO-owned task recorded sir.'));
  } else if (intent === 'maintenance') {
    const maintenance = maintenanceSnapshot();
    lines.push(
      '',
      'Maintenance status:',
      `Dry-run actions: ${maintenance.dryRun.length}`,
      `Executed actions: ${maintenance.executed.length}`,
      `Blocked actions: ${maintenance.blocked.length}`,
      ...formatMaintenanceActions(maintenance.recent, 'No maintenance run recorded yet.')
    );
  }

  return applyPersonality('cto', lines);
}

function buildCoderResponse(intent, topic, state) {
  const tasks = summarizeTasksForAgent('coder');
  const completed = state.sections.completedFixes;
  const next = state.sections.nextPriority[0] || 'No coding task recorded yet.';
  const lines = [
    'Sir, recorded work mattum report panren.',
    'No fake progress. No code change claim unless log proves it.',
    '',
    'My queue:',
    ...formatTaskList(tasks.owned, 'No coder-owned task assigned yet.'),
    '',
    'Latest recorded fix:',
    ...bullet(completed, 'No completed fix recorded in latest run.'),
    '',
    `Next coding step waiting: ${topic || next}`
  ];

  if (intent === 'current_work') {
    lines.push('', 'Files touched info comes only from report/memory; no live coding claim.');
  } else if (intent === 'maintenance') {
    const maintenance = maintenanceSnapshot();
    lines.push('', 'Cleaned / proposed:', ...formatMaintenanceActions(maintenance.executed.length ? maintenance.executed : maintenance.dryRun, 'No cleanup executed yet. Dry-run first.'));
  }

  return applyPersonality('coder', lines);
}

function buildReviewerResponse(intent, topic, state) {
  const tasks = summarizeTasksForAgent('reviewer');
  const validation = state.validation.map((item) => `${item.task}: ${String(item.status || 'unknown').toUpperCase()}`);
  const lines = [
    'Sir, review side la risk view ready.',
    '',
    'Review queue:',
    ...formatTaskList(intent === 'blocked_tasks' ? tasks.blocked : tasks.owned, 'No reviewer-owned task waiting.'),
    '',
    'Validation:',
    ...bullet(validation, 'No validation result available.'),
    '',
    'Main concern:',
    ...bullet(state.sections.risks.concat(state.sections.unresolved).slice(0, 4), 'No regression concern recorded.')
  ];

  if (topic) lines.push('', `Topic focus: ${topic}`);
  if (intent === 'maintenance') {
    const maintenance = maintenanceSnapshot();
    lines.push('', 'Maintenance risks:', ...formatMaintenanceActions(maintenance.skipped.concat(maintenance.blocked), 'No maintenance risk recorded.'));
  }
  return applyPersonality('reviewer', lines);
}

function buildAuditorResponse(intent, topic, state) {
  const tasks = summarizeTasksForAgent('auditor');
  const dangerous = state.sections.unresolved
    .concat(state.sections.risks)
    .filter((item) => /secret|unsafe|danger|critical|oversized|large|stale/i.test(item));

  const lines = [
    'Sir, dangerous items mattum flag panren.',
    '',
    'Audit queue:',
    ...formatTaskList(intent === 'tasks' ? tasks.owned : tasks.critical, 'No critical audit task recorded.'),
    '',
    'Current audit finding:',
    ...bullet(dangerous, 'No dangerous issue recorded in latest state.'),
    '',
    `Stale check: ${state.workflowFreshness ? state.workflowFreshness.message : 'not evaluated'}`
  ];

  if (intent === 'maintenance') {
    const maintenance = maintenanceSnapshot();
    lines.push('', 'Dangerous maintenance actions:', ...formatMaintenanceActions(maintenance.blocked, 'No dangerous maintenance action executed.'));
  }

  if (topic) lines.push(`Topic focus: ${topic}`);
  return applyPersonality('auditor', lines);
}

function bullet(items, fallback) {
  if (!items || items.length === 0) return [`\u2022 ${fallback}`];
  return items.slice(0, 4).map((item) => `\u2022 ${item}`);
}

function formatHealth(state) {
  return state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
}

module.exports = {
  routeAgentMessage,
  buildAgentResponse,
  AGENTS
};
