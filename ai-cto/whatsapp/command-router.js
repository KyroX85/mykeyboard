const { generateResponse } = require('./response-generator');
const { routeAgentMessage } = require('./agent-router');
const { isStandaloneGreeting } = require('./natural-intent-parser');
const { logRoutingDecision } = require('./routing-debug');
const {
  parseSpawnRequest,
  requestSpecialistSpawn,
  answerSpecialistSpawn,
  readSpawnState
} = require('./specialist-agent-manager');
const { runFreshScan, formatFreshScanResponse } = require('./live-scan-runner');
const { executeFirstFixableIssue } = require('../scripts/execution-engine');

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
  ['school mode', 'school_mode'],
  ['school update', 'school_mode'],
  ['7am update', 'school_mode'],
  ['scan now', 'scan_now'],
  ['fresh scan', 'scan_now'],
  ['live scan', 'scan_now'],
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
  if (isStandaloneGreeting(message)) {
    const greetingRoute = routeAgentMessage(message, state, memory);
    if (greetingRoute) {
      return {
        command: greetingRoute.command,
        agent: greetingRoute.agent,
        intent: greetingRoute.intent,
        details: {
          agent: greetingRoute.agent,
          intent: greetingRoute.intent,
          focusTopic: greetingRoute.topic,
          continuity: greetingRoute.continuity
        },
        matchedRoute: 'greeting_first',
        response: greetingRoute.response
      };
    }
  }

  const executionDecision = maybeRouteExecutionDecision(normalized);
  if (executionDecision) return executionDecision;

  const spawnDecision = maybeRouteSpawnDecision(normalized);
  if (spawnDecision) return spawnDecision;

  const spawnRequest = parseSpawnRequest(message);
  if (spawnRequest) {
    const proposal = requestSpecialistSpawn(spawnRequest);
    return {
      command: 'spawn_request',
      details: { agent: 'cto', intent: 'spawn_request' },
      matchedRoute: 'spawn_request',
      response: `🎯 CTO: Spawning: ${proposal.name} — Reason: ${proposal.reason} — Task: ${proposal.task} — Duration: ${proposal.duration}\nFounder Sir, reply YES or NO.`
    };
  }

  if (/\b(scan now|fresh scan|live scan)\b/.test(normalized)) {
    const freshState = runFreshScan();
    return {
      command: 'scan_now',
      details: { agent: 'cto', intent: 'scan_now' },
      matchedRoute: 'exact_command',
      response: formatFreshScanResponse(freshState)
    };
  }

  if (COMMAND_ALIASES.has(normalized) || normalized.startsWith('focus ')) {
    const routed = { ...routeCommand(message, state, memory), matchedRoute: 'exact_command' };
    logRoutingDecision({
      incoming: message,
      normalized,
      detectedAgent: routed.details.agent,
      intent: routed.command,
      confidence: 1,
      matchedRoute: 'exact_command',
      fallbackUsed: false
    });
    return routed;
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
        focusTopic: agentRoute.topic,
        continuity: agentRoute.continuity,
        directive: agentRoute.directive || null
      },
      matchedRoute: 'agent_intent',
      response: agentRoute.response
    };
  }

  if (shouldUseGeneralFallback(normalized)) {
    logRoutingDecision({
      incoming: message,
      normalized,
      detectedAgent: null,
      intent: 'conversational_fallback',
      confidence: 0.5,
      matchedRoute: 'conversational_fallback',
      fallbackUsed: true,
      fallbackReason: normalized ? 'general_conversation' : 'empty_body'
    });
    return {
      command: 'conversational_fallback',
      details: { fallbackReason: normalized ? 'general_conversation' : 'empty_body' },
      matchedRoute: 'conversational_fallback',
      response: generateResponse('conversational_fallback', state, memory, {
        fallbackReason: normalized ? 'general_conversation' : 'empty_body'
      })
    };
  }

  logRoutingDecision({
    incoming: message,
    normalized,
    detectedAgent: null,
    intent: 'conversational_fallback',
    confidence: 0.25,
    matchedRoute: 'safe_low_confidence_fallback',
    fallbackUsed: true,
    fallbackReason: 'low_confidence_unknown'
  });
  return {
    command: 'conversational_fallback',
    details: { fallbackReason: 'low_confidence_unknown' },
    matchedRoute: 'safe_low_confidence_fallback',
    response: generateResponse('conversational_fallback', state, memory, {
      fallbackReason: 'low_confidence_unknown'
    })
  };
}

function maybeRouteExecutionDecision(normalized) {
  if (normalized === 'skip') {
    return {
      command: 'execution_skip',
      details: { agent: 'cto', intent: 'execution_skip' },
      matchedRoute: 'execution_decision',
      response: '🎯 CTO: Skipped sir. No file changed. I will keep reporting the issue until it is fixed or dismissed.'
    };
  }

  if (normalized !== 'fix') return null;

  const result = executeFirstFixableIssue({
    commit: true,
    push: process.env.CTO_EXECUTION_PUSH === 'true'
  });

  return {
    command: 'execution_fix',
    details: { agent: 'cto', intent: 'execution_fix', result },
    matchedRoute: 'execution_decision',
    response: formatExecutionResponse(result)
  };
}

function compactPreview(value) {
  return String(value || '')
    .split(/\r?\n/)
    .slice(0, 2)
    .join(' / ')
    .slice(0, 180);
}

function formatExecutionResponse(result) {
  if (result.status === 'COMPLETED') {
    return [
      '🎯 CTO: Fix executed sir.',
      `Risk: ${result.riskLevel}`,
      `Changed: ${(result.files || []).join(', ')}`,
      `Before: ${compactPreview(result.before)}`,
      `After: ${compactPreview(result.after)}`
    ].join('\n');
  }

  if (result.status === 'ROLLED_BACK') {
    return [
      '🎯 CTO: Tried once, rollback done sir.',
      `Risk: ${result.riskLevel}`,
      'Reason: validation failed.',
      'Next: I need founder approval before another attempt.'
    ].join('\n');
  }

  if (result.status === 'STAGING_REQUIRED' || result.status === 'FOUNDER_APPROVAL_REQUIRED') {
    return [
      '🎯 CTO: I cannot auto-fix this sir.',
      `Risk: ${result.riskLevel}`,
      'Options:',
      '1. Approve staging branch fix',
      '2. Skip',
      '3. Ask for safer patch proposal'
    ].join('\n');
  }

  return [
    '🎯 CTO: No safe execution happened sir.',
    `Status: ${result.status}`,
    `Reason: ${result.reason || result.message || 'No low-risk fix available.'}`
  ].join('\n');
}

function maybeRouteSpawnDecision(normalized) {
  if (!['yes', 'y', 'no', 'n'].includes(normalized)) return null;
  const spawnState = readSpawnState();
  if (!spawnState.pending) return null;
  const result = answerSpecialistSpawn(normalized);
  if (result.status === 'APPROVED') {
    return {
      command: 'spawn_approved',
      details: { agent: 'cto', intent: 'spawn_approved' },
      matchedRoute: 'spawn_decision',
      response: `🎯 CTO: Approved. ${result.agent.name} active now, reports to CTO only. Scope: ${result.agent.task}.`
    };
  }
  if (result.status === 'DENIED') {
    return {
      command: 'spawn_denied',
      details: { agent: 'cto', intent: 'spawn_denied' },
      matchedRoute: 'spawn_decision',
      response: `🎯 CTO: Cancelled ${result.agent.name}. No specialist created.`
    };
  }
  return null;
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
