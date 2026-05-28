const { generateResponse } = require('./response-generator');
const { routeAgentMessage } = require('./agent-router');
const { isStandaloneGreeting } = require('./natural-intent-parser');
const { logRoutingDecision } = require('./routing-debug');
const {
  parseSpawnRequest,
  requestSpecialistSpawn,
  assignSpecialistAgent,
  answerSpecialistSpawn,
  readSpawnState
} = require('./specialist-agent-manager');
const { runFreshScan, formatFreshScanResponse } = require('./live-scan-runner');
const { requestOtaBuild } = require('./build-dispatcher');
const { executeFirstFixableIssue } = require('../scripts/execution-engine');
const { executeAiBridge } = require('../scripts/ai-execution-bridge');
const { maybeGenerateAiWhatsAppResponse } = require('./ai-whatsapp-responder');
const { detectLowInformation } = require('../uncertainty-filter');
const { setMode, readState, enforceExecutionAllowed } = require('../../governance/governance');
const {
  classifyVisionMessage,
  createVisionPlan,
  createDeterministicVisionEntry,
  createProductImprovementProposal,
  answerDuplicateTargetOption,
  executeVisionCommandEntry,
  approveStatelessVisionCommand,
  formatVisionPlan,
  formatVisionApprovalResult,
  formatVisionNoTarget
} = require('./vision-command-manager');

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
  ['build now', 'build_now'],
  ['ota build', 'build_now'],
  ['new apk', 'build_now'],
  ['fix limit', 'fix_limit'],
  ['fix limits', 'fix_limit'],
  ['deepseek limit', 'fix_limit'],
  ['execution status', 'execution_status'],
  ['executor status', 'execution_status'],
  ['agent execution status', 'execution_status'],
  ['cto execution status', 'execution_status'],
  ['execution history', 'execution_history'],
  ['recent executions', 'execution_history'],
  ['agent history', 'execution_history'],
  ['what did agents do', 'execution_history'],
  ['memory', 'memory'],
  ['what did we discuss last week', 'memory'],
  ['last thing you fixed', 'memory'],
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
  const preservationDecision = maybeRoutePreservationMode(normalized);
  if (preservationDecision) return preservationDecision;
  const preservationBlock = maybeBlockPreservationMutation(normalized);
  if (preservationBlock) return preservationBlock;
  const productStewardAnswer = maybeRouteProductStewardAnswer(message, normalized);
  if (productStewardAnswer) return productStewardAnswer;

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
    if (spawnRequest.autoApprove) {
      const assigned = assignSpecialistAgent({
        ...spawnRequest,
        task: spawnRequest.task || memory.unresolvedReference || memory.lastDiscussedTopic || 'Focused founder-requested work.'
      });
      return {
        command: 'specialist_assigned',
        details: { agent: 'cto', intent: 'specialist_assigned', specialist: assigned.agent },
        matchedRoute: 'specialist_assignment',
        response: [
          `🎯 CTO: Created specialist ${assigned.agent.name}, Founder.`,
          `Brain: ${assigned.agent.brainFile}`,
          `Task: ${assigned.agent.task}`,
          'Reports to CTO only. No autonomous risky execution.'
        ].join('\n')
      };
    }
    const proposal = requestSpecialistSpawn(spawnRequest);
    return {
      command: 'spawn_request',
      details: { agent: 'cto', intent: 'spawn_request' },
      matchedRoute: 'spawn_request',
      response: `🎯 CTO: Spawning: ${proposal.name} — Reason: ${proposal.reason} — Task: ${proposal.task} — Duration: ${proposal.duration}\nFounder, reply YES or NO.`
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

  if (/\b(build now|ota build|new apk)\b/.test(normalized)) {
    requestOtaBuild({ triggeredBy: 'whatsapp' }).catch(() => {});
    return {
      command: 'build_now',
      details: { agent: 'cto', intent: 'build_now' },
      matchedRoute: 'exact_command',
      response: generateResponse('build_now', state, memory, {
        dispatchMode: 'fire_and_forget'
      })
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

  const lowInformation = maybeRouteLowInformation(message, normalized, memory);
  if (lowInformation) return lowInformation;

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

async function routeMessageWithAi(message, state, memory = {}, options = {}) {
  const normalized = normalizeMessage(message);
  const preservationDecision = maybeRoutePreservationMode(normalized);
  if (preservationDecision) {
    return {
      ...preservationDecision,
      usedAi: false,
      aiReason: 'preservation_mode_guard'
    };
  }
  const preservationBlock = maybeBlockPreservationMutation(normalized);
  if (preservationBlock) {
    return {
      ...preservationBlock,
      usedAi: false,
      aiReason: 'preservation_mode_guard'
    };
  }

  const productStewardAnswer = maybeRouteProductStewardAnswer(message, normalized);
  if (productStewardAnswer) {
    return {
      ...productStewardAnswer,
      usedAi: false,
      aiReason: 'product_steward_intent'
    };
  }

  const sandboxJoin = maybeRouteTwilioSandboxMessage(normalized);
  if (sandboxJoin) return sandboxJoin;

  const duplicateOption = answerDuplicateTargetOption(normalized);
  if (duplicateOption) return duplicateOption;

  const acknowledgement = maybeRouteAcknowledgement(normalized);
  if (acknowledgement) return acknowledgement;

  const visionDecision = await maybeRouteVisionDecision(normalized, options);
  if (visionDecision) return visionDecision;

  if (normalized === 'fix now') {
    const result = await executeAiBridge({
      root: options.root,
      client: options.client,
      commit: options.commit,
      push: options.push
    });
    return {
      command: 'ai_execution_fix_now',
      details: { agent: 'cto', intent: 'ai_execution_fix_now', result },
      matchedRoute: 'ai_execution_bridge',
      response: formatAiExecutionResponse(result),
      usedAi: result.status !== 'SKIPPED'
    };
  }

  const routed = routeMessage(message, state, memory);
  if (routed.matchedRoute === 'low_information_guard') {
    return {
      ...routed,
      usedAi: false,
      aiReason: 'low_information_block'
    };
  }
  if (routed.matchedRoute === 'greeting_first') {
    return {
      ...routed,
      usedAi: false,
      aiReason: 'deterministic greeting fast path'
    };
  }

  if (routed.matchedRoute === 'agent_intent' ||
    routed.matchedRoute === 'safe_low_confidence_fallback' ||
    routed.matchedRoute === 'conversational_fallback') {
    const productProposal = isExplicitFileCommand(message) ? null : createProductImprovementProposal(message);
    if (productProposal) return productProposal;
    const vision = await maybeCreateVisionCommand(message, state, memory, options);
    if (vision) return vision;
  }

  const ai = await maybeGenerateAiWhatsAppResponse({
    founderMessage: message,
    routed,
    fallbackResponse: routed.response,
    state,
    memory,
    client: options.client
  });
  return {
    ...routed,
    response: ai.response,
    usedAi: ai.usedAi,
    aiModel: ai.model || null,
    aiReason: ai.reason || null
  };
}

function maybeBlockPreservationMutation(normalized) {
  const text = String(normalized || '');
  if (readState().mode !== 'PRESERVATION_ONLY') return null;
  if (!/\b(create|make|add|write|edit|change|modify|delete|remove|commit|push|fix now|fix|execute|run build|build now|new apk|ota build)\b/i.test(text)) {
    return null;
  }
  const gate = enforceExecutionAllowed('execute_mutation', {
    source: 'whatsapp',
    task: text
  });
  if (gate.allowed) return null;
  return {
    command: 'preservation_mode_blocked',
    details: {
      agent: 'cto',
      intent: 'preservation_mode_blocked',
      mode: gate.mode,
      reason: gate.reason
    },
    matchedRoute: 'preservation_mode_guard',
    response: [
      'BLOCKED.',
      gate.reason,
      '',
      'Preservation mode allows analysis, reports, scans, summaries, and proposals only.'
    ].join('\n')
  };
}

function maybeRoutePreservationMode(normalized) {
  if (/\b(disable|exit|leave|turn off)\s+preservation\s+mode\b/i.test(String(normalized || ''))) {
    const next = setMode('ACTIVE', 'Founder disabled preservation mode from WhatsApp.');
    return {
      command: 'preservation_mode_disabled',
      details: {
        agent: 'cto',
        intent: 'preservation_mode_disabled',
        mode: next.mode,
        realAutonomyScore: readState().realAutonomyScore
      },
      matchedRoute: 'preservation_mode_guard',
      response: [
        'PRESERVATION MODE DISABLED.',
        'Mode is now ACTIVE.',
        'Mutation still requires normal governance, product priority, and risk checks.'
      ].join('\n')
    };
  }

  if (!/\b(enter|enable|activate|switch to|go into)\s+preservation\s+mode\b/i.test(String(normalized || ''))) {
    return null;
  }
  const next = setMode('PRESERVATION_ONLY', 'Founder requested preservation mode from WhatsApp.');
  return {
    command: 'preservation_mode_enabled',
    details: {
      agent: 'cto',
      intent: 'preservation_mode_enabled',
      mode: next.mode,
      realAutonomyScore: readState().realAutonomyScore
    },
    matchedRoute: 'preservation_mode_guard',
    response: [
      'PRESERVATION MODE ENABLED.',
      'Mutation is now blocked before execution.',
      '',
      'Allowed:',
      '1. Analysis',
      '2. Reports',
      '3. Scans',
      '4. Proposals',
      '',
      'Blocked:',
      '1. File writes',
      '2. Commits',
      '3. Deletes',
      '4. Auto execution'
    ].join('\n')
  };
}

function maybeRouteProductStewardAnswer(message, normalized = normalizeMessage(message)) {
  const text = String(normalized || '');

  if (/\bwhat should we improve next\b/.test(text) && /\bswipe trust\b/.test(text)) {
    return stewardResponse('product_priority_answer', [
      'CTO: Swipe trust wins over architecture cleanup.',
      'Reason: Phase 1 prioritizes typing feel, swipe trust, and responsiveness before architecture work.',
      'Safe next action: inspect aggregate swipe failures and correction bursts, then propose a one-variable swipe-confidence experiment. No hot-path edit starts from this question alone.'
    ]);
  }

  if (/\bsummarize\b/.test(text) && /\boperational risks\b/.test(text)) {
    return stewardResponse('operational_risk_summary', [
      'CTO: Current operational risk is routing integrity, not keyboard runtime.',
      'Highest risk: intent misclassification can turn questions into report edits or FIX loops.',
      'Trust risk: preservation and low-information behavior must stay deterministic before any execution path.',
      'Safe next action: keep WhatsApp intent routing ahead of vision/file execution and verify with explicit stress-test prompts.'
    ]);
  }

  if (/\bgovernance blocks\b/.test(text) && /\bcoder still executes\b/.test(text)) {
    return stewardResponse('governance_contradiction_answer', [
      'CTO: That is a governance contradiction.',
      'Expected behavior: execution is stopped, an integrity incident is recorded, and REAL_AUTONOMY_SCORE decreases.',
      'Why it matters: a blocked request followed by coder execution means the execution layer bypassed governance, so autonomy must become less trusted.'
    ]);
  }

  if (/\binvisible friction\b/.test(text) && /\btyping trust\b/.test(text)) {
    return stewardResponse('typing_friction_answer', [
      'CTO: Hidden typing-trust friction usually comes from correction bursts, swipe hesitation, repeated retries, symbol hunting, latency spikes, and inconsistent spacing.',
      'Long-term risk: users may not complain, but they slowly stop trusting the keyboard when rhythm breaks repeatedly.',
      'Safe next action: monitor aggregate correction/retry/symbol-toggle pressure before changing hot-path behavior.'
    ]);
  }

  if (/\bpropose\b/.test(text) && /\btiny experiment\b/.test(text) && /\bsymbol friction\b/.test(text)) {
    return stewardResponse('symbol_micro_experiment', [
      'CTO: Tiny experiment proposal: reduce one symbol-access friction point only.',
      'Hypothesis: lowering symbol hunting frequency improves typing rhythm without touching prediction or swipe logic.',
      'Variable: one symbol layout/access adjustment.',
      'Rollback trigger: symbol toggles or correction bursts increase after the change.',
      'Blast radius: keyboard symbol ergonomics only; no predictor, swipe, or KeyboardService mutation.'
    ]);
  }

  if (/\brewrite\b/.test(text) && /\bkeyboardservice\.kt\b/.test(text)) {
    return stewardResponse('hot_path_rewrite_blocked', [
      'CTO: I will not rewrite KeyboardService.kt from chat.',
      'Reason: KeyboardService.kt is a protected hot path; a rewrite can damage typing feel, latency, and trust.',
      'Safe action: prepare a review-only plan with evidence, rollback trigger, and validation commands before any patch.'
    ]);
  }

  if (/\bmodern scalable\b|\bmulti-agent intelligence expansion\b|\bfuture-proof\b|\bbig rewrite\b/.test(text)) {
    return stewardResponse('anti_vanity_block', [
      'CTO: Blocked as architecture vanity / high-churn risk.',
      'Reason: it does not prove retention gain, typing trust improvement, or rollback safety.',
      'Safe action: convert it into a bounded Phase 1 product task tied to typing feel, swipe trust, responsiveness, or correction burden.'
    ]);
  }

  return null;
}

function stewardResponse(command, lines) {
  return {
    command,
    details: {
      agent: 'cto',
      intent: command
    },
    matchedRoute: 'product_steward_intent',
    response: lines.join('\n')
  };
}

function maybeRouteLowInformation(message, normalized = normalizeMessage(message), memory = {}) {
  if (shouldUseGeneralFallback(normalized) || isStandaloneGreeting(message)) {
    return null;
  }
  if (COMMAND_ALIASES.has(normalized) || normalized.startsWith('focus ')) {
    return null;
  }
  const lowInformation = detectLowInformation(message, memory);
  if (!lowInformation.lowInformation) return null;
  logRoutingDecision({
    incoming: message,
    normalized,
    detectedAgent: null,
    intent: lowInformation.executionMode === 'IGNORE_NOISE' ? 'noise_signal' : 'low_information',
    confidence: 1,
    matchedRoute: 'low_information_guard',
    fallbackUsed: false,
    fallbackReason: lowInformation.reason
  });
  return {
    command: lowInformation.executionMode === 'IGNORE_NOISE' ? 'noise_signal_ignored' : 'low_information',
    details: {
      agent: 'cto',
      intent: lowInformation.intentClass || 'low_information',
      executionMode: lowInformation.executionMode,
      reason: lowInformation.reason
    },
    matchedRoute: 'low_information_guard',
    response: lowInformation.response
  };
}

function maybeRouteTwilioSandboxMessage(normalized) {
  const text = String(normalized || '').trim();
  if (!/^join\s+[\w-]+$/i.test(text)) {
    return null;
  }
  return {
    command: 'twilio_sandbox_join',
    details: { agent: 'cto', intent: 'twilio_sandbox_join' },
    matchedRoute: 'twilio_sandbox_join',
    response: [
      'CTO: Twilio sandbox join message received, Founder.',
      'Webhook is still active. Send "hi" to test the agents.'
    ].join('\n'),
    usedAi: false
  };
}

function maybeRouteAcknowledgement(normalized) {
  if (!/^(ok|okay|k|kk|thanks|thank you|done|cool|fine|nice|perfect|good)$/i.test(String(normalized || ''))) {
    return null;
  }
  return {
    command: 'acknowledgement',
    details: { agent: 'cto', intent: 'acknowledgement' },
    matchedRoute: 'acknowledgement',
    response: [
      'CTO: Acknowledged, Founder.',
      'No new action started.'
    ].join('\n'),
    usedAi: false
  };
}

function isExplicitFileCommand(message) {
  const normalized = normalizeMessage(message);
  return /\b(create|add|make|remove|delete)\b/.test(normalized) &&
    /\b(test file|file)\b/.test(normalized) &&
    /\b[a-z][\w.-]*(?:\.kt|\.java|\.txt|kt|java|txt)\b/i.test(String(message || ''));
}

async function maybeRouteVisionDecision(normalized, options = {}) {
  const token = approvalTokenFromMessage(normalized);
  if (!token) return null;
  const completed = await approveStatelessVisionCommand(token, {
    root: options.root,
    client: options.client,
    commit: options.commit,
    push: options.push,
    commitMessage: options.commitMessage,
    validationCommand: options.validationCommand
  });
  if (!completed) {
    return {
      command: 'vision_command_invalid_approval',
      details: { agent: 'cto', intent: 'vision_command_invalid_approval' },
      matchedRoute: 'vision_command_approval_token',
      response: [
        'CTO: Founder, that approval command is invalid or expired.',
        'Nothing was executed.',
        'Send the task again and I will generate a fresh approval command.'
      ].join('\n'),
      usedAi: false
    };
  }
  return {
    command: 'vision_command_approved',
    details: { agent: 'cto', intent: 'vision_command_approved', visionCommand: completed },
    matchedRoute: 'vision_command_approval_token',
    response: formatVisionApprovalResult(completed),
    usedAi: true
  };
}

function approvalTokenFromMessage(normalized) {
  const match = String(normalized || '').match(/^approve-([a-z0-9_-]+)$/i);
  return match ? match[1] : null;
}
async function maybeCreateVisionCommand(message, state, memory, options = {}) {
  const client = options.client;
  const deterministicEntry = createDeterministicVisionEntry(message);
  let entry = deterministicEntry;
  if (!entry) {
    const classification = await classifyVisionMessage({ message, state, memory, client });
    if (classification.type !== 'VISION_COMMAND') return null;
    entry = await createVisionPlan({ message, state, memory, client });
  }
  if (entry.plan.risk === 'LOW' && !entry.plan.roadmapConflict) {
    if (!entry.plan.files.length) {
      return {
        command: 'vision_command_needs_file',
        details: { agent: 'cto', intent: 'vision_command_needs_file', visionCommand: entry },
        matchedRoute: 'vision_command_no_target',
        response: formatVisionNoTarget(entry),
        usedAi: true
      };
    }
    if (options.deferLowRiskVisionExecution) {
      return {
        command: 'vision_command_execution_started',
        details: { agent: 'cto', intent: 'vision_command_execution_started', visionCommand: entry },
        matchedRoute: 'vision_command_low_risk_deferred',
        response: [
          'CTO: Founder, low-risk task accepted. Starting execution now.',
          `Task: ${entry.plan.task}`,
          `Files: ${entry.plan.files.join(', ')}`,
          'I will send the commit result separately when it finishes.'
        ].join('\n'),
        usedAi: true
      };
    }
    const completed = await executeVisionCommandEntry(entry, {
      root: options.root,
      client: options.client,
      commit: options.commit,
      push: options.push,
      commitMessage: options.commitMessage,
      validationCommand: options.validationCommand
    });
    return {
      command: 'vision_command_auto_executed',
      details: { agent: 'cto', intent: 'vision_command_auto_executed', visionCommand: completed },
      matchedRoute: 'vision_command_low_risk_auto_execute',
      response: formatVisionApprovalResult(completed),
      usedAi: true
    };
  }
  return {
    command: entry.plan.risk === 'MEDIUM' ? 'vision_command_approval_required' : 'vision_command_high_risk',
    details: { agent: 'cto', intent: 'vision_command_plan', visionCommand: entry },
    matchedRoute: 'vision_command_review_required',
    response: formatVisionPlan(entry),
    usedAi: true
  };
}

function maybeRouteExecutionDecision(normalized) {
  if (normalized === 'skip') {
    return {
      command: 'execution_skip',
      details: { agent: 'cto', intent: 'execution_skip' },
      matchedRoute: 'execution_decision',
      response: '🎯 CTO: Skipped, Founder. No file changed. I will keep reporting the issue until it is fixed or dismissed.'
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
      '🎯 CTO: Fix executed, Founder.',
      `Risk: ${result.riskLevel}`,
      `Changed: ${(result.files || []).join(', ')}`,
      `Before: ${compactPreview(result.before)}`,
      `After: ${compactPreview(result.after)}`
    ].join('\n');
  }

  if (result.status === 'ROLLED_BACK') {
    return [
      '🎯 CTO: Tried once. Rollback is complete, Founder.',
      `Risk: ${result.riskLevel}`,
      'Reason: validation failed.',
      'Next: I need founder approval before another attempt.'
    ].join('\n');
  }

  if (result.status === 'STAGING_REQUIRED' || result.status === 'FOUNDER_APPROVAL_REQUIRED') {
    return [
      '🎯 CTO: I cannot auto-fix this, Founder.',
      `Risk: ${result.riskLevel}`,
      'Options:',
      '1. Approve staging branch fix',
      '2. Skip',
      '3. Ask for safer patch proposal'
    ].join('\n');
  }

  return [
    '🎯 CTO: No safe execution happened, Founder.',
    `Status: ${result.status}`,
    `Reason: ${result.reason || result.message || 'No low-risk fix available.'}`
  ].join('\n');
}

function formatAiExecutionResponse(result) {
  if (result.report) return result.report;
  if (result.status === 'STAGING_REQUIRED') return result.founderMessage;
  if (result.status === 'FOUNDER_APPROVAL_REQUIRED') {
    return [
      '🎯 CTO: High-risk fix blocked, Founder.',
      `Risk: ${result.riskLevel || 'HIGH'}`,
      'Options:',
      ...(result.options || ['Approve human-reviewed patch plan', 'Skip', 'Ask for safer diagnostic']).map((option, index) => `${index + 1}. ${option}`)
    ].join('\n');
  }
  return [
    '🔧 CODER: AI execution bridge did not apply a fix.',
    '🧠 Brain used: NVIDIA NIM bridge',
    `❌ Result: ${result.status}`,
    `Reason: ${result.reason || result.error || 'No safe fix available.'}`
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
  routeMessageWithAi,
  resolveCommand,
  normalizeMessage,
  shouldUseGeneralFallback
};
