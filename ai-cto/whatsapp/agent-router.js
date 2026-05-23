const { parseNaturalIntent } = require('./natural-intent-parser');
const { logRoutingDecision } = require('./routing-debug');
const { buildConversationMemory } = require('./conversational-memory');
const { buildNaturalResponse } = require('./natural-response-builder');

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
    continuity: parsed.continuity,
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
    continuity: parsed.continuity,
    directive: parsed.directive || null,
    response: buildAgentResponse(agent, parsed.intent, parsed.topic, state, memory, {
      detailMode: parsed.detailMode,
      continuity: parsed.continuity,
      directive: parsed.directive
    })
  };
}

function buildAgentResponse(agent, intent, topic, state, memory, options = {}) {
  const groundedMemory = buildConversationMemory({
    agent,
    intent,
    topic,
    state,
    priorMemory: {
      ...memory,
      currentContinuity: options.continuity || null,
      currentDirective: options.directive || null
    }
  });
  return buildNaturalResponse({
    agent,
    intent,
    topic,
    state,
    memory: groundedMemory,
    detailMode: options.detailMode,
    directive: options.directive || null
  });
}

function clarificationResponse() {
  return [
    'Founder, which worker should answer?',
    'Try: CTO summary, coder progress, reviewer risks, auditor dangerous issues.'
  ].join('\n');
}

module.exports = {
  routeAgentMessage,
  buildAgentResponse
};
