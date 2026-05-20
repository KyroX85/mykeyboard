const { generateResponse } = require('./response-generator');
const { routeAgentMessage } = require('./agent-router');

const COMMAND_ALIASES = new Map([
  ['status', 'status'],
  ['cto status', 'status'],
  ['health', 'health'],
  ['score', 'health'],
  ['latest risks', 'risks'],
  ['risks', 'risks'],
  ['risk', 'risks'],
  ['momentum', 'momentum'],
  ['what changed', 'what_changed'],
  ['changed', 'what_changed'],
  ['changes', 'what_changed'],
  ['latest fixes', 'latest_fixes'],
  ['fixes', 'latest_fixes'],
  ['unresolved', 'unresolved'],
  ['pending issues', 'pending_issues'],
  ['issues', 'pending_issues'],
  ['pending', 'pending_issues'],
  ['pending approvals', 'approvals'],
  ['next priorities', 'next_priorities'],
  ['next priority', 'next_priorities'],
  ['priorities', 'next_priorities'],
  ['priority', 'next_priorities'],
  ['approvals', 'approvals'],
  ['approval', 'approvals'],
  ['keyboard health', 'keyboard_health'],
  ['keyboard', 'keyboard_health'],
  ['cto summary', 'cto_summary'],
  ['weekly summary', 'weekly_summary'],
  ['week summary', 'weekly_summary'],
  ['summary', 'weekly_summary'],
  ['help', 'help']
]);

const GREETING_WORDS = new Set(['hey', 'hi', 'hello', 'sup', 'yo', 'vanakkam']);
const GENERAL_FALLBACK_PATTERNS = [
  /\bupdate\b/i,
  /\bwhat'?s going on\b/i,
  /\bwhats going on\b/i,
  /\bwhat is going on\b/i,
  /\bwhat happened\b/i,
  /\bwhat changed\b/i,
  /\bblocked\b/i,
  /\bblocker\b/i
];

function normalizeMessage(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolveCommand(message) {
  const normalized = normalizeMessage(message);
  if (normalized.startsWith('focus ')) {
    const topic = normalized.replace(/^focus\s+/, '').trim();
    return topic ? { command: 'focus', focusTopic: topic } : { command: 'malformed' };
  }

  if (!normalized) return { command: 'malformed' };
  if (COMMAND_ALIASES.has(normalized)) return COMMAND_ALIASES.get(normalized);

  for (const [alias, command] of COMMAND_ALIASES.entries()) {
    if (normalized.includes(alias)) return command;
  }

  return 'unknown';
}

function routeMessage(message, state, memory = {}) {
  const normalized = normalizeMessage(message);
  if (COMMAND_ALIASES.has(normalized) || normalized.startsWith('focus ')) {
    return { ...routeCommand(message, state, memory), matchedRoute: 'exact_command' };
  }

  const agentRoute = routeAgentMessage(message, state, memory);
  if (agentRoute) {
    return {
      command: agentRoute.command,
      agent: agentRoute.agent,
      intent: agentRoute.intent,
      details: {
        agent: agentRoute.agent,
        intent: agentRoute.intent,
        focusTopic: agentRoute.topic
      },
      matchedRoute: 'agent_intent',
      response: agentRoute.response
    };
  }

  if (shouldUseGeneralFallback(normalized)) {
    return {
      command: 'conversational_fallback',
      details: { fallbackReason: normalized ? 'general_conversation' : 'empty_body' },
      matchedRoute: 'conversational_fallback',
      response: generateResponse('conversational_fallback', state, memory, {
        fallbackReason: normalized ? 'general_conversation' : 'empty_body'
      })
    };
  }

  return {
    command: 'conversational_fallback',
    details: { fallbackReason: 'low_confidence_unknown' },
    matchedRoute: 'safe_low_confidence_fallback',
    response: generateResponse('conversational_fallback', state, memory, {
      fallbackReason: 'low_confidence_unknown'
    })
  };
}

function routeCommand(message, state, memory = {}) {
  const resolved = resolveCommand(message);
  const command = typeof resolved === 'string' ? resolved : resolved.command;
  const details = typeof resolved === 'string' ? {} : resolved;

  return {
    command,
    details,
    response: generateResponse(command, state, memory, details)
  };
}

function shouldUseGeneralFallback(normalized) {
  if (!normalized) return true;
  if (GREETING_WORDS.has(normalized)) return true;
  if (normalized.split(' ').some((word) => GREETING_WORDS.has(word))) return true;
  return GENERAL_FALLBACK_PATTERNS.some((pattern) => pattern.test(normalized));
}

module.exports = {
  routeMessage,
  resolveCommand,
  normalizeMessage,
  shouldUseGeneralFallback
};
