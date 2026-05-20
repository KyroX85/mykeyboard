const { parseNaturalIntent } = require('./natural-intent-parser');
const { applyPersonality, clarificationResponse } = require('./personality-layer');

function routeAgentMessage(message, state, memory = {}) {
  const parsed = parseNaturalIntent(message, memory);
  if (!parsed.matched) return null;

  if (!parsed.agent && parsed.confidence < 0.5) {
    return {
      command: 'agent_clarify',
      agent: null,
      intent: parsed.intent,
      topic: parsed.topic,
      response: clarificationResponse()
    };
  }

  const agent = parsed.agent || 'cto';
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

function buildCtoResponse(intent, topic, state, memory) {
  const lines = [
    `Health: ${formatHealth(state)}`,
    `Momentum: ${state.momentum || 'UNKNOWN'}`,
    `Focus: ${topic || memory.currentSprintFocus || state.summary.nextPriority}`,
    `Next: ${state.summary.nextPriority}`
  ];

  if (intent === 'approvals') {
    lines.push('', 'Pending approvals:', ...bullet(state.sections.approvals, 'No approval item pending sir.'));
  } else if (intent === 'risks') {
    lines.push('', 'Risk view:', ...bullet(state.sections.risks, 'No new critical risk recorded sir.'));
  }

  return applyPersonality('cto', lines);
}

function buildCoderResponse(intent, topic, state) {
  const completed = state.sections.completedFixes;
  const next = state.sections.nextPriority[0] || 'No coding task recorded yet.';
  const lines = [
    'Inniku recorded work dhaan report panren sir.',
    'Fake progress solla matten.',
    '',
    'Latest recorded fixes:',
    ...bullet(completed, 'No completed fix recorded in latest run.'),
    '',
    `Next coding step: ${topic || next}`
  ];

  if (intent === 'current_work') {
    lines.push('', 'Files touched info comes only from report/memory; no live coding claim.');
  }

  return applyPersonality('coder', lines);
}

function buildReviewerResponse(intent, topic, state) {
  const validation = state.validation.map((item) => `${item.task}: ${String(item.status || 'unknown').toUpperCase()}`);
  const lines = [
    'One validation lens la paathen sir.',
    '',
    'Validation:',
    ...bullet(validation, 'No validation result available.'),
    '',
    'Regression concerns:',
    ...bullet(state.sections.risks.concat(state.sections.unresolved).slice(0, 4), 'No regression concern recorded.')
  ];

  if (topic) lines.push('', `Topic focus: ${topic}`);
  return applyPersonality('reviewer', lines);
}

function buildAuditorResponse(intent, topic, state) {
  const dangerous = state.sections.unresolved
    .concat(state.sections.risks)
    .filter((item) => /secret|unsafe|danger|critical|oversized|large|stale/i.test(item));

  const lines = [
    'Dangerous items mattum flag panren sir.',
    '',
    'Audit findings:',
    ...bullet(dangerous, 'No dangerous issue recorded in latest state.'),
    '',
    `Stale check: ${state.workflowFreshness ? state.workflowFreshness.message : 'not evaluated'}`
  ];

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
  buildAgentResponse
};
