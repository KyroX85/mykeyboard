function routeHumanInteraction(message = '', state = {}, memory = {}) {
  const text = normalize(message);
  if (!text || isExplicitExecution(text)) return null;
  if (hasExplicitSpecialistAddress(text)) return null;

  if (isCasualStatus(text)) {
    return humanRoute('human_status_check', buildStatusAnswer(state, memory), {
      founderMessage: message,
      topic: 'status',
      pendingAction: inferPendingAction(state, memory)
    });
  }

  if (asksMonitoring(text)) {
    return humanRoute('human_monitoring_answer', buildMonitoringAnswer(state), {
      founderMessage: message,
      topic: 'monitoring',
      pendingAction: inferPendingAction(state, memory)
    });
  }

  if (asksCurrentWork(text)) {
    return humanRoute('human_current_work_answer', buildCurrentWorkAnswer(state, memory), {
      founderMessage: message,
      topic: 'current work',
      pendingAction: inferPendingAction(state, memory)
    });
  }

  if (asksWhatChanged(text)) {
    return humanRoute('human_recent_changes_answer', buildRecentChangesAnswer(state), {
      founderMessage: message,
      topic: 'recent changes',
      pendingAction: inferPendingAction(state, memory)
    });
  }

  if (asksBlocker(text)) {
    return humanRoute('human_blocker_answer', buildBlockerAnswer(state), {
      founderMessage: message,
      topic: 'blocker',
      pendingAction: inferPendingAction(state, memory)
    });
  }

  if (isBareFix(text)) {
    return humanRoute('human_fix_continuity', buildFixContinuityAnswer(state, memory), {
      founderMessage: message,
      topic: 'fix continuity',
      pendingAction: inferPendingAction(state, memory)
    });
  }

  return null;
}

function buildStatusAnswer(state = {}, memory = {}) {
  const health = metricWithProvenance(state, 'health');
  const momentum = metricWithProvenance(state, 'momentum');
  const pending = inferPendingAction(state, memory);
  return [
    'Things are running, but not clean.',
    `Health: ${health.value}`,
    `Source: ${health.source}`,
    `Reason: ${health.reason}`,
    `Calculation: ${health.calculation}`,
    '',
    `Momentum: ${momentum.value}`,
    `Source: ${momentum.source}`,
    `Reason: ${momentum.reason}`,
    `Calculation: ${momentum.calculation}`,
    '',
    `Main thing I am watching: ${first(state.sections && state.sections.unresolved) || first(state.sections && state.sections.risks) || 'unknown'}`,
    `Pending action: ${pending || 'none recorded'}`
  ].join('\n');
}

function buildMonitoringAnswer(state = {}) {
  const health = metricWithProvenance(state, 'health');
  return [
    'I am monitoring the repo and agent system, not inventing product progress.',
    '',
    `Current monitored areas: ${monitoringAreas(state).join(', ') || 'unknown'}.`,
    `Top watched item: ${first(state.sections && state.sections.unresolved) || first(state.sections && state.sections.risks) || 'unknown'}`,
    '',
    `Health: ${health.value}`,
    `Source: ${health.source}`,
    `Reason: ${health.reason}`,
    `Calculation: ${health.calculation}`
  ].join('\n');
}

function buildCurrentWorkAnswer(state = {}, memory = {}) {
  const pending = inferPendingAction(state, memory);
  return [
    'Right now I am in monitoring and controlled-maintenance mode.',
    `Last recorded improvement: ${first(state.sections && state.sections.completedFixes) || state.changed && first(state.changed.completed) || 'unknown'}`,
    `Current watched risk: ${first(state.sections && state.sections.risks) || first(state.sections && state.sections.unresolved) || 'unknown'}`,
    `Pending action: ${pending || 'none recorded'}`,
    'I will not claim active coding unless an execution actually started.'
  ].join('\n');
}

function buildRecentChangesAnswer(state = {}) {
  return [
    'Recent change signal:',
    `Last scan: ${state.generatedAt || 'unknown'}`,
    `Completed: ${first(state.sections && state.sections.completedFixes) || state.changed && first(state.changed.completed) || 'unknown'}`,
    `New risk: ${first(state.sections && state.sections.risks) || state.changed && first(state.changed.newRisks) || 'none recorded'}`,
    `Next recorded priority: ${first(state.sections && state.sections.nextPriority) || 'unknown'}`
  ].join('\n');
}

function buildBlockerAnswer(state = {}) {
  return [
    'Current blocker:',
    first(state.sections && state.sections.risks) ||
      first(state.sections && state.sections.unresolved) ||
      first(state.sections && state.sections.approvals) ||
      'unknown',
    '',
    'I am treating this as a status question, not an execution request.'
  ].join('\n');
}

function buildFixContinuityAnswer(state = {}, memory = {}) {
  const pending = inferPendingAction(state, memory);
  return [
    pending
      ? `The pending fix target I can see is: ${pending}`
      : 'I do not have a specific pending fix target from the current conversation.',
    'If you mean the top current repo issue, say "fix top safe issue".',
    'If you mean the thing we were discussing, name it once so I do not mutate the wrong area.',
    'No execution started from this bare "fix" message.'
  ].join('\n');
}

function metricWithProvenance(state = {}, key) {
  const metric = state.metricProvenance && state.metricProvenance[key];
  if (!metric || !metric.value || metric.source === 'unknown') {
    return {
      value: 'unknown',
      source: 'unknown',
      reason: 'No verified metric source was loaded.',
      calculation: 'unknown'
    };
  }
  return metric;
}

function monitoringAreas(state = {}) {
  const areas = ['brain scan freshness', 'roadmap alignment', 'WhatsApp routing'];
  const unresolved = [
    ...array(state.sections && state.sections.unresolved),
    ...array(state.sections && state.sections.risks)
  ].join(' ').toLowerCase();
  if (/keyboard|ime|input|swipe|predictor/.test(unresolved)) areas.push('keyboard foundation risk');
  if (/whatsapp|routing|agent|memory|governance/.test(unresolved)) areas.push('agent reliability');
  return areas;
}

function inferPendingAction(state = {}, memory = {}) {
  return memory.pendingAction ||
    memory.nextContinuationAction ||
    memory.lastActiveTask ||
    memory.unresolvedReference ||
    memory.lastRequestedAction ||
    first(state.sections && state.sections.nextPriority) ||
    first(state.sections && state.sections.safestOpportunity) ||
    first(state.sections && state.sections.approvals) ||
    null;
}

function humanRoute(command, response, details = {}) {
  return {
    command,
    matchedRoute: 'human_interaction_layer',
    details: {
      agent: 'cto',
      intent: command,
      conversationMode: 'HUMAN_CONVERSATION',
      skipExecutionSchema: true,
      founderMessage: details.founderMessage || null,
      topic: details.topic || null,
      pendingAction: details.pendingAction || null
    },
    response
  };
}

function isCasualStatus(text) {
  return /\b(ok\s+)?(how'?s|hows|how is|how are)\b.*\b(going|things|work|progress)\b/.test(text) ||
    /\bhow\s+work\s+(is\s+)?going\b/.test(text) ||
    /\b(enna|epdi|eppadi).*\b(poguthu|going)\b/.test(text) ||
    /\beverything okay\b/.test(text);
}

function asksMonitoring(text) {
  return /\bwhat\s+(are|r)\s+(you|u)\s+monitoring\b/.test(text) ||
    /\bwhat.*watching\b/.test(text);
}

function asksCurrentWork(text) {
  return /\bwhat\s+(are|r)\s+(you|u)\s+(working on|doing)\b/.test(text) ||
    /\bwhat.*currently working\b/.test(text);
}

function asksWhatChanged(text) {
  return /\bwhat changed\b/.test(text) || /\bwhat.*improvements?.*(today|recently)?\b/.test(text);
}

function asksBlocker(text) {
  return /\b(blocking|blocker|stuck|blocking progress)\b/.test(text);
}

function isBareFix(text) {
  return /^(fix|fix it|fix this|fix that)$/i.test(String(text || '').trim());
}

function isExplicitExecution(text) {
  if (isBareFix(text)) return false;
  return /\b(execute|implement|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|approve-)\b/.test(text);
}

function hasExplicitSpecialistAddress(text) {
  return /\b(coder|dev|developer|reviewer|auditor|auditer)\b/.test(text);
}

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\S\r\n]+/g, ' ').trim();
}

function first(items) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  routeHumanInteraction,
  metricWithProvenance,
  monitoringAreas,
  inferPendingAction
};
