const OUTPUT_TYPES = new Set([
  'AUDIT_REPORT',
  'TASK_PLAN',
  'EXECUTION_RESULT',
  'CLARIFICATION_REQUEST'
]);

function enforceExecutionSchemaOnRoute(route = {}, {
  message = '',
  memorySources = []
} = {}) {
  if (!route || typeof route !== 'object') return route;
  const classification = classifyExecutionIntent({ message, route });
  const outputType = outputTypeForIntent(classification.intentType);
  const checked = selfCheck({
    route,
    classification,
    outputType
  });

  if (!checked.ok) {
    return {
      ...route,
      command: 'clarification_required',
      matchedRoute: 'execution_schema_guard',
      details: {
        ...(route.details || {}),
        executionSchema: {
          intentType: 'unclear',
          outputType: 'CLARIFICATION_REQUEST',
          reason: checked.reason
        }
      },
      response: formatSchemaResponse({
        outputType: 'CLARIFICATION_REQUEST',
        intentType: 'unclear',
        memorySources,
        body: [
          `reason: ${checked.reason}`,
          'needed_information:',
          '- Confirm whether you want an audit, a task plan, or execution.',
          'execution_started: false'
        ].join('\n')
      })
    };
  }

  return {
    ...route,
    details: {
      ...(route.details || {}),
      executionSchema: {
        intentType: classification.intentType,
        outputType,
        confidence: classification.confidence
      }
    },
    response: formatSchemaResponse({
      outputType,
      intentType: classification.intentType,
      memorySources,
      body: stripSchemaEnvelope(route.response)
    })
  };
}

function classifyExecutionIntent({ message = '', route = {} } = {}) {
  const text = String(message || '').toLowerCase();
  const command = String(route.command || '').toLowerCase();
  const matchedRoute = String(route.matchedRoute || '').toLowerCase();
  const combined = `${command} ${matchedRoute} ${text}`;

  if (/\baudit\b/.test(text) || /memory_audit|audit/.test(combined)) {
    return { intentType: 'audit', confidence: 0.95 };
  }
  if (/low_information|noise_signal|clarification|unknown|safe_low_confidence/.test(combined)) {
    return { intentType: 'unclear', confidence: 0.8 };
  }
  if (/\b(fix|skip|execute|implement|commit|push|build now|run product lab|capture screenshot|latest screenshot|enter preservation mode|disable preservation mode|create a file|create file|delete file|modify file)\b/.test(text) ||
    /\brewrite\b/.test(text) ||
    /\b(execution|fix|build|approved|workflow|screenshot|rewrite_blocked)\b/.test(combined)) {
    return { intentType: 'execution_command', confidence: 0.86 };
  }
  if (/^(agent|status|health|risks|momentum|latest_fixes|pending_issues|execution_status|execution_history|keyboard_health|cto_summary|weekly_summary|school_mode|focus|memory)$/.test(command)) {
    return { intentType: 'planning_request', confidence: 0.8 };
  }
  if (command && !/^(low_information|noise_signal_ignored|unknown|malformed|clarification_required)$/.test(command)) {
    return { intentType: 'planning_request', confidence: 0.78 };
  }
  if (/\b(plan|propose|design|prepare|review|should we|what should|roadmap|priority)\b/.test(text) ||
    /\b(proposal|plan|phase2|product_priority|vision_steward)\b/.test(combined)) {
    return { intentType: 'planning_request', confidence: 0.78 };
  }
  if (/\b(what|why|how|when|where|which|can|does|is|are)\b/.test(text) || text.includes('?')) {
    return { intentType: 'question', confidence: 0.74 };
  }
  return { intentType: 'unclear', confidence: 0.5 };
}

function outputTypeForIntent(intentType) {
  if (intentType === 'audit') return 'AUDIT_REPORT';
  if (intentType === 'planning_request' || intentType === 'question') return 'TASK_PLAN';
  if (intentType === 'execution_command') return 'EXECUTION_RESULT';
  return 'CLARIFICATION_REQUEST';
}

function selfCheck({ route = {}, classification = {}, outputType = '' } = {}) {
  if (!OUTPUT_TYPES.has(outputType)) return { ok: false, reason: 'Invalid output schema.' };
  if ((classification.confidence || 0) < 0.7) return { ok: false, reason: 'Intent confidence below 70%.' };
  if (classification.intentType === 'audit' && outputType !== 'AUDIT_REPORT') {
    return { ok: false, reason: 'Audit intent must use AUDIT_REPORT only.' };
  }
  if (classification.intentType !== 'audit' && outputType === 'AUDIT_REPORT') {
    return { ok: false, reason: 'Non-audit intent cannot use AUDIT_REPORT.' };
  }
  const response = String(route.response || '');
  if (classification.intentType !== 'execution_command' && /\b(commit:\s*[a-f0-9]{6,}|files changed:|implemented:|done, founder)(?:\b|\s|$)/i.test(response)) {
    return { ok: false, reason: 'Non-execution intent attempted to claim execution.' };
  }
  return { ok: true };
}

function formatSchemaResponse({ outputType, intentType, memorySources = [], body = '' } = {}) {
  const cleanBody = stripMemoryHeader(String(body || '').trim());
  const sources = Array.isArray(memorySources) && memorySources.length
    ? memorySources.join(', ')
    : 'current message';
  return [
    `Memory Sources Used: ${sources}`,
    `type: ${outputType}`,
    `intent: ${intentType}`,
    cleanBody
  ].filter(Boolean).join('\n');
}

function stripSchemaEnvelope(value = '') {
  return String(value || '')
    .replace(/^Memory Sources Used:[^\n]*\n?/i, '')
    .replace(/^type:\s*(AUDIT_REPORT|TASK_PLAN|EXECUTION_RESULT|CLARIFICATION_REQUEST)\s*\n?/i, '')
    .replace(/^intent:\s*[a-z_]+\s*\n?/i, '')
    .trim();
}

function stripMemoryHeader(value = '') {
  return String(value || '').replace(/^Memory Sources Used:[^\n]*\n?/i, '').trim();
}

module.exports = {
  classifyExecutionIntent,
  enforceExecutionSchemaOnRoute,
  formatSchemaResponse,
  outputTypeForIntent,
  selfCheck
};
