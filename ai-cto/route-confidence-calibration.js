const { buildCuriosityPrompt, formatCuriosityPrompt } = require('./curiosity-layer');

const LOW_CONFIDENCE_THRESHOLD = 70;

function calibrateRouteConfidence(route = {}, {
  message = '',
  memory = {}
} = {}) {
  const details = route.details || {};
  const explicit = explicitConfidence(details);
  if (explicit != null) {
    return buildCalibration(explicit, explicitReason(details, route));
  }

  const command = String(route.command || '').toLowerCase();
  const matchedRoute = String(route.matchedRoute || '').toLowerCase();
  const combined = `${command} ${matchedRoute}`;

  if (details.reinforcementPreferred && details.routeReinforcement) {
    const score = Number(details.routeReinforcement.score || 0);
    return buildCalibration(
      Math.min(88, Math.max(72, 74 + score * 2)),
      'reinforcement memory favors this conversation route'
    );
  }

  if (/preservation|blocked|anti_vanity|rewrite_blocked/.test(combined)) {
    return buildCalibration(92, 'explicit safety or governance route matched');
  }
  if (/build_now|execution_fix|execution_skip|vision_command_approved|product_lab_screenshot|screenshot/.test(combined)) {
    return buildCalibration(90, 'explicit execution or product-lab command matched');
  }
  if (command === 'founder_feedback_recorded') {
    return buildCalibration(88, 'founder message directly matched feedback language');
  }
  if (command === 'founder_mind_reconstruction') {
    return buildCalibration(84, 'founder-thinking route matched reflective, doubt, or vision language');
  }
  if (command === 'founder_objective' || /founder_objective/.test(combined)) {
    return buildCalibration(80, 'founder objective route matched objective-seeking language');
  }
  if (command === 'recent_product_improvements') {
    return buildCalibration(86, 'question matched git-grounded product progress route');
  }
  if (/exact_command/.test(combined)) {
    return buildCalibration(94, 'message matched an exact command alias');
  }
  if (command === 'agent') {
    if (details.intent === 'greeting') {
      return buildCalibration(93, 'standalone greeting matched the team-ready route');
    }
    return buildCalibration(76, 'agent-specific question matched a named agent route');
  }
  if (/low_information|noise_signal_ignored/.test(combined)) {
    return buildCalibration(82, 'message matched low-information or stress-test guard');
  }
  if (/safe_low_confidence_fallback/.test(combined)) {
    return buildCalibration(38, 'no specific route matched; safe fallback selected');
  }
  if (/conversational_fallback/.test(combined)) {
    return buildCalibration(55, 'general conversation fallback matched without strong product intent');
  }

  const hasSessionEvidence = Boolean(memory && (
    memory.lastDiscussedTopic ||
    memory.previousFounderQuestion ||
    memory.lastFounderConcern
  ));
  return buildCalibration(hasSessionEvidence ? 58 : 45, 'route has no calibrated matcher; confidence is limited');
}

function attachRouteConfidence(response = '', calibration = {}) {
  const text = String(response || '').trim();
  if (/^Route Confidence:\s*\d+%/im.test(text)) return text;
  return [
    `Route Confidence: ${calibration.confidence}%`,
    `Route Reason: ${calibration.reason}`,
    text
  ].filter(Boolean).join('\n');
}

function maybeApplyCuriosity(response = '', route = {}, calibration = {}, {
  message = ''
} = {}) {
  const text = String(response || '');
  if (calibration.confidence >= LOW_CONFIDENCE_THRESHOLD) return text;
  if (isExecutionRoute(route)) return text;
  if (/Useful follow-up:/i.test(text)) return text;

  const curiosity = buildCuriosityPrompt({
    message,
    category: route.details && route.details.category,
    intent: route.details && route.details.intent,
    confidence: calibration.confidence
  });
  const formatted = formatCuriosityPrompt(curiosity);
  if (!formatted) return text;
  return [text.trim(), '', formatted].filter(Boolean).join('\n');
}

function explicitConfidence(details = {}) {
  const candidates = [
    details.routeConfidence && details.routeConfidence.confidence,
    details.confidence,
    details.conversationRouteConfidence,
    details.executionSchema && details.executionSchema.confidence
  ];
  for (const candidate of candidates) {
    const normalized = normalizeConfidence(candidate);
    if (normalized != null) return normalized;
  }
  return null;
}

function explicitReason(details = {}, route = {}) {
  return (details.routeConfidence && details.routeConfidence.reason) ||
    details.conversationRouteReason ||
    details.selfCheck ||
    `${route.matchedRoute || route.command || 'route'} supplied explicit confidence`;
}

function normalizeConfidence(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number <= 1) return Math.round(number * 100);
  return Math.max(0, Math.min(100, Math.round(number)));
}

function buildCalibration(confidence, reason) {
  return {
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    reason: String(reason || 'route confidence inferred from matcher strength'),
    threshold: LOW_CONFIDENCE_THRESHOLD,
    curiosityActivated: Math.round(confidence) < LOW_CONFIDENCE_THRESHOLD
  };
}

function isExecutionRoute(route = {}) {
  return /\b(execution|fix|commit|build|vision_command|approval|product_lab_screenshot|screenshot|preservation)\b/i.test(
    `${route.command || ''} ${route.matchedRoute || ''}`
  );
}

module.exports = {
  LOW_CONFIDENCE_THRESHOLD,
  calibrateRouteConfidence,
  attachRouteConfidence,
  maybeApplyCuriosity
};
