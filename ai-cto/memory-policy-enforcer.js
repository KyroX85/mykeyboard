const FULL_RECALL_PATTERNS = [
  /\bi remember everything\b/i,
  /\bi have full chat history\b/i,
  /\bfrom the full chat\b/i,
  /\bfull conversation history\b/i,
  /\bas we discussed earlier\b/i,
  /\bwe already decided\b/i
];

const {
  calibrateRouteConfidence,
  attachRouteConfidence,
  maybeApplyCuriosity
} = require('./route-confidence-calibration');
const {
  shouldSelfCritiqueAnswer,
  generateSelfCritique
} = require('./self-critique-layer');

function enforceMemoryPolicyOnRoute(route = {}, {
  message = '',
  memory = {},
  founderMemoryLayer = null,
  executionRelevant = false
} = {}) {
  if (!route || typeof route !== 'object') return route;
  const routeConfidence = calibrateRouteConfidence(route, { message, memory });
  const responseWithMemory = enforceMemoryPolicyOnResponse(route.response, {
    message,
    memory,
    founderMemoryLayer,
    executionRelevant: executionRelevant || isExecutionRoute(route)
  });
  const suppressRouteConfidence = Boolean(route.details && route.details.suppressRouteConfidence);
  const responseWithConfidence = suppressRouteConfidence
    ? responseWithMemory
    : attachRouteConfidence(responseWithMemory, routeConfidence);
  const selfCritique = route.details && route.details.suppressSelfCritique
    ? null
    : maybeGenerateSelfCritique(message, responseWithConfidence, route);
  return {
    ...route,
    details: {
      ...(route.details || {}),
      routeConfidence,
      ...(selfCritique ? { selfCritique } : {})
    },
    response: maybeApplyCuriosity(responseWithConfidence, route, routeConfidence, { message, memory })
  };
}

function enforceMemoryPolicyOnResponse(response = '', {
  message = '',
  memory = {},
  founderMemoryLayer = null,
  executionRelevant = false
} = {}) {
  const original = String(response || '').trim();
  const repaired = repairUnsupportedRecallClaims(original);
  if (hasMemorySourceDeclaration(repaired)) return repaired;
  return [
    `Memory Sources Used: ${buildMemorySources({ message, memory, founderMemoryLayer, executionRelevant }).join(', ')}`,
    repaired
  ].filter(Boolean).join('\n');
}

function buildMemorySources({
  message = '',
  memory = {},
  founderMemoryLayer = null,
  executionRelevant = false
} = {}) {
  const sources = ['current message'];
  if (hasShortTermContext(memory)) sources.push('short-term context');
  if (hasSessionSummary(memory)) sources.push('session memory');
  else sources.push('session memory unavailable');
  if (founderMemoryLayer || isFounderContextQuestion(message)) sources.push('persistent founder memory');
  if (executionRelevant || hasExecutionMemory(memory)) sources.push('execution memory');
  return Array.from(new Set(sources));
}

function memorySourcesFromResponse(response = '') {
  const match = String(response || '').match(/^Memory Sources Used:\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasMemorySourceDeclaration(value = '') {
  return /^Memory Sources Used:\s*/i.test(String(value || '').trim());
}

function repairUnsupportedRecallClaims(value = '') {
  let output = String(value || '');
  for (const pattern of FULL_RECALL_PATTERNS) {
    if (pattern.test(output)) {
      output = output.replace(pattern, 'based only on loaded memory sources');
    }
  }
  return output;
}

function hasShortTermContext(memory = {}) {
  return Array.isArray(memory.recentMessages) && memory.recentMessages.length > 0;
}

function hasSessionSummary(memory = {}) {
  return Boolean(
    memory.sessionSummary ||
    memory.lastDiscussedTopic ||
    memory.lastActiveTask ||
    memory.semanticFounderState ||
    hasShortTermContext(memory)
  );
}

function hasExecutionMemory(memory = {}) {
  return Boolean(
    memory.activeExecution ||
    memory.executionState ||
    memory.pendingApproval ||
    memory.lastRequestedAction ||
    memory.nextContinuationAction
  );
}

function isExecutionRoute(route = {}) {
  return /\b(execution|fix|commit|build|vision_command|approval|product_lab_screenshot_workflow)\b/i.test(
    `${route.command || ''} ${route.matchedRoute || ''}`
  );
}

function isFounderContextQuestion(message = '') {
  return /\b(project|founder|company|vision|phase|stage|roadmap|final goal|north star|memory audit|what are we building|what product)\b/i.test(
    String(message || '')
  );
}

function maybeGenerateSelfCritique(message = '', response = '', route = {}) {
  if (!shouldSelfCritiqueAnswer(response, { founderMessage: message, route })) return null;
  return generateSelfCritique({
    founderMessage: message,
    agentAnswer: response,
    context: {
      route
    }
  });
}

module.exports = {
  buildMemorySources,
  enforceMemoryPolicyOnResponse,
  enforceMemoryPolicyOnRoute,
  hasMemorySourceDeclaration,
  memorySourcesFromResponse
};
