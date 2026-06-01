const FORBIDDEN_TEMPLATE_PATTERNS = [
  /\bHealth\s*:?\s*\d{1,3}\s*\/?\s*100\b/i,
  /\bHealth\s+\d{1,3}\b/i,
  /\bMomentum\s*:?\s*(STALLED|stalled)\b/i,
  /\bTeam\s+(is\s+)?ready\b/i,
  /\bReview\s+Gate\b/i,
  /\bCurrent Foundation Health\b/i,
  /\bcomplexity report\b/i,
  /\bproduct-governance\.js\b.*\bcomplexity\b/i
];

const EXPLICIT_STATUS_PATTERNS = [
  /^status$/i,
  /^health$/i,
  /^momentum$/i,
  /^risks?$/i,
  /^what\s+(are|r)\s+(you|u)\s+monitoring\??$/i,
  /\b(how'?s|hows|how is|how are)\b.*\b(going|things|work|progress)\b/i,
  /\bhow\s+work\s+(is\s+)?going\b/i,
  /\b(full report|detailed update|status update|execution update)\b/i
];

const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|sup|vanakkam)$/i,
  /^anyone\s+home\??$/i
];

function enforceAntiTemplateOnRoute(route, {
  message = '',
  state = {}
} = {}) {
  if (!route || typeof route.response !== 'string') return route;
  if (!containsForbiddenTemplate(route.response)) return route;
  if (allowsStatusTemplate(message, route, state)) return route;
  const confidence = route.details && route.details.routeConfidence;
  const confidenceLines = confidence
    ? [
        `Route Confidence: ${confidence.confidence}%`,
        `Route Reason: ${confidence.reason}`
      ]
    : [];

  return {
    ...route,
    command: 'anti_template_conversation_guard',
    matchedRoute: 'anti_template_layer',
    details: {
      ...(route.details || {}),
      agent: (route.details && route.details.agent) || 'cto',
      intent: 'anti_template_conversation_guard',
      originalCommand: route.command,
      originalMatchedRoute: route.matchedRoute,
      blockedTemplate: true,
      skipExecutionSchema: true
    },
    response: [
      ...confidenceLines,
      'That would be the wrong response path.',
      'You are asking a conversation or product-judgment question, not requesting a status template.',
      'I should answer your actual concern directly and avoid health, momentum, team-ready, review-gate, or complexity-report blocks unless you explicitly ask for sourced status.'
    ].join('\n')
  };
}

function containsForbiddenTemplate(response = '') {
  return FORBIDDEN_TEMPLATE_PATTERNS.some((pattern) => pattern.test(String(response || '')));
}

function allowsStatusTemplate(message = '', route = {}, state = {}) {
  const text = String(message || '').trim();
  if (route.details && route.details.classification === 'PHASE2_CONVERSATION') return true;
  if (GREETING_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (route.command === 'human_status_check' || route.command === 'human_monitoring_answer') return true;
  if (['status', 'health', 'momentum', 'risks', 'focus'].includes(route.command)) return true;
  if (!EXPLICIT_STATUS_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return hasMetricEvidence(state);
}

function hasMetricEvidence(state = {}) {
  const provenance = state.metricProvenance || {};
  return Boolean(
    (provenance.health && provenance.health.source && provenance.health.source !== 'unknown') ||
    (provenance.momentum && provenance.momentum.source && provenance.momentum.source !== 'unknown')
  );
}

module.exports = {
  enforceAntiTemplateOnRoute,
  containsForbiddenTemplate,
  allowsStatusTemplate
};
