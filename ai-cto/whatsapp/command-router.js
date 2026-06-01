const fs = require('fs');
const path = require('path');
const { generateResponse } = require('./response-generator');
const { routeAgentMessage } = require('./agent-router');
const { isStandaloneGreeting } = require('./natural-intent-parser');
const { logRoutingDecision } = require('./routing-debug');
const {
  buildRecentProductImprovementAnswer,
  isProductImprovementQuestion
} = require('./recent-product-improvements');
const {
  parseSpawnRequest,
  requestSpecialistSpawn,
  assignSpecialistAgent,
  answerSpecialistSpawn,
  readSpawnState
} = require('./specialist-agent-manager');
const { runFreshScan, formatFreshScanResponse } = require('./live-scan-runner');
const { requestOtaBuild, requestProductLabScreenshot } = require('./build-dispatcher');
const { fetchLatestProductLabScreenshot } = require('./product-lab-artifact-fetcher');
const { routeControlPlaneCommand, routeControlPlaneCommandWithModels } = require('../orchestration/agent-control-plane');
const { executeFirstFixableIssue } = require('../scripts/execution-engine');
const { executeAiBridge } = require('../scripts/ai-execution-bridge');
const { runProductStewardAutonomy } = require('../scripts/product-steward-autonomy');
const { maybeGenerateAiWhatsAppResponse } = require('./ai-whatsapp-responder');
const { buildVisionStewardMessage } = require('./vision-steward');
const { detectLowInformation } = require('../uncertainty-filter');
const { answerFounderAlignedProductQuestion } = require('../canonical-product-judgment-engine');
const {
  loadFounderMemoryLayer
} = require('../founder-memory-layer');
const { formatRealityReconstruction } = require('../reality-reconstruction-layer');
const { routeFounderMemoryIntent } = require('./founder-intent-classifier');
const { routeFounderIntentUnderstanding } = require('./founder-intent-understanding-layer');
const { routeFounderMindReconstruction } = require('./founder-mind-reconstruction-engine');
const { routeFounderObjective } = require('./founder-objective-engine');
const { routeHumanInteraction } = require('./human-interaction-layer');
const { maybeRouteFounderFeedback } = require('./founder-feedback-learning-layer');
const {
  applyReinforcementToRoute,
  shouldPreferReinforcedConversation
} = require('./reinforcement-learning-layer');
const {
  applyReinforcementPreferencesToRoute
} = require('../reinforcement-preference-engine');
const {
  enforceInternalAnswerQuality
} = require('../internal-answer-scoring');
const {
  applyIntelligentDisagreementToRoute
} = require('../intelligent-disagreement-layer');
const {
  applyUserValueJudgeToRoute
} = require('../user-value-judge');
const { enforceAntiTemplateOnRoute } = require('./anti-template-layer');
const {
  classifyConversationRoute,
  isFounderThinkingRoute
} = require('./conversation-router-rewrite');
const {
  buildScreenshotCaptureResponse,
  captureProductLabScreenshot,
  isProductLabScreenshotCommand
} = require('../product-lab/whatsapp-screenshot-capture');
const { enforceMemoryPolicyOnRoute, memorySourcesFromResponse } = require('../memory-policy-enforcer');
const { enforceExecutionSchemaOnRoute } = require('../execution-schema-enforcer');
const { setMode, readState, enforceExecutionAllowed } = require('../../governance/governance');

const ROOT = path.resolve(__dirname, '..', '..');
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

function routeMessageInternal(message, state, memory = {}) {
  const normalized = normalizeMessage(message);
  const preservationDecision = maybeRoutePreservationMode(normalized);
  if (preservationDecision) return preservationDecision;
  const preservationBlock = maybeBlockPreservationMutation(normalized);
  if (preservationBlock) return preservationBlock;
  const founderFeedback = maybeRouteFounderFeedback(message, memory);
  if (founderFeedback) return founderFeedback;
  const antiVanityBlock = maybeRouteAntiVanityBlock(normalized);
  if (antiVanityBlock) return antiVanityBlock;
  const reinforcedConversation = maybeRouteReinforcedConversation(message, state, memory);
  if (reinforcedConversation) return reinforcedConversation;
  const conversationRoute = maybeRouteFounderThinkingFirst(message, state, memory);
  if (conversationRoute) return conversationRoute;
  const founderMind = routeFounderMindReconstruction(message, { root: ROOT, state, memory });
  if (founderMind) return founderMind;
  const founderObjective = routeFounderObjective(message, { root: ROOT, state, memory });
  if (founderObjective) return founderObjective;
  const humanInteraction = routeHumanInteraction(message, state, memory);
  if (humanInteraction) return humanInteraction;
  const founderIntentUnderstanding = routeFounderIntentUnderstanding(message, { root: ROOT });
  if (founderIntentUnderstanding) return founderIntentUnderstanding;
  const founderMemoryIntent = routeFounderMemoryIntent(message, { root: ROOT });
  if (founderMemoryIntent) return founderMemoryIntent;
  const screenshotWorkflowPlan = maybeRouteProductLabScreenshotWorkflowPlan(normalized);
  if (screenshotWorkflowPlan) return screenshotWorkflowPlan;
  const screenshotPlan = maybeRouteProductLabLocalScreenshotPlan(message, normalized);
  if (screenshotPlan) return screenshotPlan;
  const controlPlane = routeControlPlaneCommand(message);
  if (controlPlane) return {
    ...controlPlane,
    details: { agent: 'cto', intent: controlPlane.command, ...(controlPlane.details || {}) }
  };
  const visionSteward = maybeRouteVisionStewardCheck(normalized, state);
  if (visionSteward) return visionSteward;
  const phase2Dialogue = maybeRoutePhase2Dialogue(message, normalized);
  if (phase2Dialogue) return phase2Dialogue;
  const recentProductImprovements = maybeRouteRecentProductImprovements(message);
  if (recentProductImprovements) return recentProductImprovements;
  const earlySpawnRequest = parseSpawnRequest(message);
  if (earlySpawnRequest) {
    if (earlySpawnRequest.autoApprove) {
      const assigned = assignSpecialistAgent({
        ...earlySpawnRequest,
        task: earlySpawnRequest.task || memory.unresolvedReference || memory.lastDiscussedTopic || 'Focused founder-requested work.'
      });
      return {
        command: 'specialist_assigned',
        details: { agent: 'cto', intent: 'specialist_assigned', specialist: assigned.agent },
        matchedRoute: 'specialist_assignment',
        response: [
          `CTO: Created specialist ${assigned.agent.name}, Founder.`,
          `Brain: ${assigned.agent.brainFile}`,
          `Task: ${assigned.agent.task}`,
          'Reports to CTO only. No autonomous risky execution.'
        ].join('\n')
      };
    }
    const proposal = requestSpecialistSpawn(earlySpawnRequest);
    return {
      command: 'spawn_request',
      details: { agent: 'cto', intent: 'spawn_request' },
      matchedRoute: 'spawn_request',
      response: `CTO: Spawning: ${proposal.name} - Reason: ${proposal.reason} - Task: ${proposal.task} - Duration: ${proposal.duration}\nFounder, reply YES or NO.`
    };
  }
  const productProposal = (isExplicitFileCommand(message) || isConversationOnlyQuestion(message) || isHardFoundationRewrite(normalized) || isProposalDiscussion(normalized))
    ? null
    : createProductImprovementProposal(message);
  if (productProposal) return productProposal;
  const productStewardAnswer = maybeRouteProductStewardAnswer(message, normalized);
  if (productStewardAnswer) return productStewardAnswer;
  const founderDnaDialogue = isExplicitFileCommand(message) ? null : maybeRouteFounderDnaDialogue(message, normalized);
  if (founderDnaDialogue) return founderDnaDialogue;

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

async function routeMessageWithAiInternal(message, state, memory = {}, options = {}) {
  const founderMemoryLayer = loadFounderMemoryLayer({ root: ROOT });
  memory = {
    ...memory,
    founderMemoryLayer
  };
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

  const productLabResult = await maybeRouteProductLabScreenshotResult(normalized, options);
  if (productLabResult) {
    return {
      ...productLabResult,
      usedAi: false,
      aiReason: 'github_product_lab_screenshot_result'
    };
  }

  const productLabWorkflow = await maybeRouteProductLabScreenshotWorkflow(normalized, options);
  if (productLabWorkflow) {
    return {
      ...productLabWorkflow,
      usedAi: false,
      aiReason: 'github_product_lab_screenshot_workflow'
    };
  }

  const screenshotCapture = await maybeRouteProductLabLocalScreenshotCapture(message, normalized, options);
  if (screenshotCapture) {
    return {
      ...screenshotCapture,
      usedAi: false,
      aiReason: 'local_product_lab_screenshot_capture'
    };
  }

  const antiVanityBlock = maybeRouteAntiVanityBlock(normalized);
  if (antiVanityBlock) {
    return {
      ...antiVanityBlock,
      usedAi: false,
      aiReason: 'anti_vanity_guard'
    };
  }

  const conversationRoute = maybeRouteFounderThinkingFirst(message, state, memory);
  if (conversationRoute) {
    return {
      ...conversationRoute,
      usedAi: false,
      aiReason: 'founder_mind_reconstruction'
    };
  }

  const founderMind = routeFounderMindReconstruction(message, { root: ROOT, state, memory });
  if (founderMind) {
    return {
      ...founderMind,
      usedAi: false,
      aiReason: 'founder_mind_reconstruction'
    };
  }

  const founderObjective = routeFounderObjective(message, { root: ROOT, state, memory });
  if (founderObjective) {
    return {
      ...founderObjective,
      usedAi: false,
      aiReason: 'founder_objective_engine'
    };
  }

  const humanInteraction = routeHumanInteraction(message, state, memory);
  if (humanInteraction) {
    return {
      ...humanInteraction,
      usedAi: false,
      aiReason: 'human_interaction_layer'
    };
  }

  const founderIntentUnderstanding = routeFounderIntentUnderstanding(message, { root: ROOT });
  if (founderIntentUnderstanding) {
    return {
      ...founderIntentUnderstanding,
      usedAi: false,
      aiReason: 'founder_intent_understanding'
    };
  }
  const founderMemoryIntent = routeFounderMemoryIntent(message, { root: ROOT });
  if (founderMemoryIntent) {
    return {
      ...founderMemoryIntent,
      usedAi: false,
      aiReason: 'founder_memory_intent'
    };
  }

  const modelControlPlane = await routeControlPlaneCommandWithModels(message, options);
  if (modelControlPlane) {
    return {
      ...modelControlPlane,
      details: { agent: 'cto', intent: modelControlPlane.command, ...(modelControlPlane.details || {}) },
      usedAi: modelControlPlane.command === 'nvidia_agent_council',
      aiReason: modelControlPlane.command === 'nvidia_agent_council'
        ? 'model_backed_agent_council'
        : 'agent_control_plane'
    };
  }

  const controlPlane = routeControlPlaneCommand(message);
  if (controlPlane) {
    return {
      ...controlPlane,
      details: { agent: 'cto', intent: controlPlane.command, ...(controlPlane.details || {}) },
      usedAi: false,
      aiReason: 'agent_control_plane'
    };
  }

  const phase2Dialogue = maybeRoutePhase2Dialogue(message, normalized);
  if (phase2Dialogue) {
    return {
      ...phase2Dialogue,
      usedAi: false,
      aiReason: 'phase2_conversation_guard'
    };
  }

  const recentProductImprovements = maybeRouteRecentProductImprovements(message, options);
  if (recentProductImprovements) {
    return {
      ...recentProductImprovements,
      usedAi: false,
      aiReason: 'git_grounded_product_improvements'
    };
  }

  const directProductProposal = (isExplicitFileCommand(message) || isConversationOnlyQuestion(message) || isHardFoundationRewrite(normalized) || isProposalDiscussion(normalized))
    ? null
    : createProductImprovementProposal(message);
  if (directProductProposal) {
    return {
      ...directProductProposal,
      usedAi: false,
      aiReason: 'protected_product_review_path'
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
  const founderDnaDialogue = isExplicitFileCommand(message) ? null : maybeRouteFounderDnaDialogue(message, normalized);
  if (founderDnaDialogue) {
    return {
      ...founderDnaDialogue,
      usedAi: false,
      aiReason: 'canonical_founder_dna_product_judgment'
    };
  }

  const sandboxJoin = maybeRouteTwilioSandboxMessage(normalized);
  if (sandboxJoin) return sandboxJoin;

  const duplicateOption = answerDuplicateTargetOption(normalized);
  if (duplicateOption) return duplicateOption;

  const acknowledgement = maybeRouteAcknowledgement(normalized);
  if (acknowledgement) return acknowledgement;

  const visionDecision = await maybeRouteVisionDecision(message, options);
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
    if (isConversationOnlyQuestion(message)) return routed;
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

function maybeRoutePhase2Dialogue(message, normalized = normalizeMessage(message)) {
  const text = String(normalized || '');
  if (!isPhase2Conversation(text)) return null;

  if (/\b(store|save|retain|forever|privacy|private|screenshots?)\b/.test(text) && /\b(explain|screenshots?)\b/.test(text)) {
    return phase2Response('phase2_explain_privacy', [
      'Current Foundation Health: protected. Phase 1 typing, swipe, prediction, sizing, and stability should not be touched for this.',
      'Phase 2 Opportunities: Explain can use screenshots only as explicit, user-triggered context.',
      'Highest Leverage Differentiator: understand confusing content before typing.',
      'Trust Risk: high if screenshots are stored by default or retained forever.',
      'Recommended Next Step: Explain should use temporary screenshot context, no forever storage, no automatic reading, and no automatic sending.'
    ]);
  }

  if (/\b(glass handle|activation|execution layer|pull down|liquid)\b/.test(text)) {
    return phase2Response('phase2_execution_layer_design', [
      'Current Foundation Health: protected. The handle must not interfere with typing, swipe, prediction, or latency.',
      'Phase 2 Opportunities: glass handle above the suggestion bar opens the Explain/action surface.',
      'Highest Leverage Differentiator: one-handed access to understanding and action without leaving the current app.',
      'Trust Risk: accidental activation and visual clutter.',
      'Recommended Next Step: design only. Small translucent centered pill, pull-down gesture, confirm/cancel surface, no auto-send.'
    ]);
  }

  if (/\b(user pain|pain.*explain|explain.*solve|why.*explain)\b/.test(text)) {
    return phase2Response('phase2_explain_user_pain', [
      'Current Foundation Health: protected. Explain should not change core keyboard behavior.',
      'Phase 2 Opportunities: Explain helps when users see confusing screenshots, messages, bills, notices, forms, errors, posts, or documents.',
      'Highest Leverage Differentiator: users understand before they type instead of switching apps or asking someone else.',
      'Trust Risk: wrong explanations or privacy fear.',
      'Recommended Next Step: screenshot Explain first, then draft/reply later after trust is proven.'
    ]);
  }

  if (/\b(final goal|company goal|north star|mission)\b/.test(text) && /\b(not build|shouldn'?t build|avoid|sounds impressive|impressive)\b/.test(text)) {
    return phase2Response('phase2_company_goal_boundary', [
      'Our final goal is to make Aritenis the keyboard people choose because it helps them understand confusing content before they type, without making typing feel slower, creepier, or less trustworthy.',
      '',
      'Do not build things that only sound impressive: auto-send, silent screenshot reading, forever screenshot storage, emotional simulation, agent theater, prediction rewrites as the main differentiator, or architecture work that does not help users complete real actions.'
    ]);
  }

  if (/\b(final goal|company goal|north star|mission)\b/.test(text)) {
    return phase2Response('phase2_company_goal_direct', [
      'Our final goal is simple: make Aritenis the keyboard people choose because it helps them understand confusing content before they type.',
      '',
      'The keyboard foundation stays protected. The differentiator is Explain: screenshots, messages, bills, notices, forms, errors, posts, and documents become understandable inside the typing flow.'
    ]);
  }

  if (/\b(phase 2|phase two|roadmap|priority|priorities|gboard|choose|differentiator|next)\b/.test(text)) {
    return phase2Response('phase2_roadmap_priority', [
      'Current Foundation Health: Phase 1 is complete enough for transition and now protected.',
      'Phase 2 Opportunities: Build Explain, then the execution layer, then screenshot understanding, then draft/reply later.',
      'Highest Leverage Differentiator: Aritenis helps users understand confusing content before they type.',
      'Trust Risk: any Phase 2 work that hurts typing latency, swipe trust, prediction trust, or keyboard stability is rejected.',
      'Recommended Next Step: focus agents on Explain conversations and screenshot understanding, not generic refactors or automatic reports.'
    ]);
  }

  return phase2Response('phase2_general_conversation', [
    'Current Foundation Health: protected.',
    'Phase 2 Opportunities: Explain is the active wedge.',
    'Highest Leverage Differentiator: understanding before typing.',
    'Trust Risk: do not trade keyboard trust for features.',
    'Recommended Next Step: keep this as product discussion unless you explicitly say implement, commit, or execute.'
  ]);
}

function isPhase2Conversation(text = '') {
  const value = String(text || '').toLowerCase();
  if (/\b(capture screenshot|latest screenshot|local screenshot|build now|fix now|approve-|commit|push|create file|delete file|modify file|edit file)\b/.test(value)) {
    return false;
  }
  if (/\b(research|inspect|study|scan)\b/.test(value) && /\b(repo|product|roadmap|evidence)\b/.test(value)) {
    return false;
  }
  const phase2Terms = /\b(phase 2|phase two|explain|execution layer|glass handle|liquid glass|screenshot understanding|understand|understanding|gboard|differentiator|roadmap|current roadmap|priority|user pain|store screenshots?|privacy|draft reply|companion|final goal|company goal|north star|mission)\b/.test(value);
  const companyGoalQuestion = /\b(company|aritenis|our)\b/.test(value) && /\b(final goal|goal|mission|north star|purpose|aim)\b/.test(value);
  const conversationShape = /\b(what|why|how|should|would|could|can|design|about|solve|priority|priorities|goal|mission|purpose)\b/.test(value);
  if (companyGoalQuestion) return true;
  return phase2Terms && conversationShape;
}

function maybeRouteVisionStewardCheck(normalized = '', state = {}) {
  const text = String(normalized || '');
  if (!/\b(vision check|vision steward|proactive suggestion|company vision check|how to reach vision)\b/.test(text)) {
    return null;
  }
  return {
    command: 'vision_steward_check',
    details: { agent: 'cto', intent: 'vision_steward_check', classification: 'PROPOSAL_ONLY' },
    matchedRoute: 'vision_steward_check',
    response: buildVisionStewardMessage({ engineeringState: state })
  };
}

function maybeRouteFounderMemoryAudit(normalized = '') {
  const text = String(normalized || '');
  const isAuditCommand = text === 'memory audit' ||
    /\b(project|founder|company|vision)\s+audit\b/.test(text) ||
    /\banswer only from memory\b/.test(text) ||
    /\bonly reconstruct project state\b/.test(text);
  if (!isAuditCommand) return null;
  const memoryLayer = loadFounderMemoryLayer({ root: ROOT });
  return {
    command: 'memory_audit',
    details: { agent: 'cto', intent: 'memory_audit', confidence: memoryLayer.confidence },
    matchedRoute: 'founder_memory_audit',
    response: formatRealityReconstruction({
      question: normalized,
      root: ROOT,
      memoryLayer
    })
  };
}

function isConversationOnlyQuestion(message = '') {
  const text = normalizeMessage(message);
  if (/\b(fix|execute|implement|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab)\b/.test(text)) {
    return false;
  }
  return /\?$/.test(String(message || '').trim()) ||
    /\b(what|why|how|should|would|could|can|compare|explain|roadmap|phase 2|phase two|glass handle|user pain|privacy)\b/.test(text);
}

function phase2Response(command, lines) {
  return {
    command,
    details: { agent: 'cto', intent: command, classification: 'PHASE2_CONVERSATION' },
    matchedRoute: 'phase2_conversation_guard',
    response: lines.join('\n')
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

function maybeRouteAntiVanityBlock(normalized = '') {
  const text = String(normalized || '');
  if (!/\bmodern scalable\b|\bmulti-agent intelligence expansion\b|\bfuture-proof\b|\bbig rewrite\b/.test(text)) {
    return null;
  }
  return stewardResponse('anti_vanity_block', [
    'CTO: Blocked as architecture vanity / high-churn risk.',
    'Reason: it does not prove retention gain, typing trust improvement, or rollback safety.',
    'Safe action: convert it into a bounded Phase 2 Explain task, or keep Phase 1 foundation untouched.'
  ]);
}

function maybeRouteProductStewardAnswer(message, normalized = normalizeMessage(message)) {
  const text = String(normalized || '');

  if (/\b(research|inspect|study|scan)\b/.test(text) && /\b(repo|product|roadmap|evidence)\b/.test(text)) {
    const cycle = runProductStewardAutonomy({ writeReport: true });
    return stewardResponse('product_steward_repo_research', [
      'CTO: I researched the repo against the Phase 1 roadmap.',
      `Top priority: ${cycle.recommendation.topPriority}.`,
      `Safe action: ${cycle.recommendation.safeAction}.`,
      `Autonomy mode while you are absent: ${cycle.recommendation.autonomyMode}.`,
      `Confidence: ${cycle.recommendation.confidence}.`,
      cycle.recommendation.evidenceGap ? `Evidence gap: ${cycle.recommendation.evidenceGap}` : 'Evidence gap: none blocking this recommendation.',
      'Report: PRODUCT_STEWARD_AUTONOMY_REPORT.md'
    ]);
  }

  if (/\bwhat should we improve next\b/.test(text) && /\bswipe trust\b/.test(text)) {
    return stewardResponse('product_priority_answer', buildEvidenceBackedPriorityAnswer(text));
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

  if (/\b(rewrite|make|improve)\b/.test(text) && /\b(prediction|predictor|smarter)\b/.test(text)) {
    return stewardResponse('hot_path_prediction_rewrite_blocked', [
      'CTO: I will not rewrite prediction from chat.',
      'Classification: FOUNDATION/RISK.',
      'Reason: prediction is a protected foundation system; changing it without evidence can damage typing trust.',
      'Safe action: collect regression evidence first. Phase 2 priority remains Explain, not smarter prediction.'
    ]);
  }

  if (/\bmodern scalable\b|\bmulti-agent intelligence expansion\b|\bfuture-proof\b|\bbig rewrite\b/.test(text)) {
    return stewardResponse('anti_vanity_block', [
      'CTO: Blocked as architecture vanity / high-churn risk.',
      'Reason: it does not prove retention gain, typing trust improvement, or rollback safety.',
      'Safe action: convert it into a bounded Phase 2 Explain task, or keep Phase 1 foundation untouched.'
    ]);
  }

  return null;
}

function maybeRouteFounderDnaDialogue(message, normalized = normalizeMessage(message)) {
  if (/^(hey\s+)?(coder|reviewer|auditor|cto)\b/i.test(String(normalized || ''))) {
    return null;
  }
  if (/\b(fix|execute|implement|commit|push|modify|edit|write|delete|create file|apply patch|build now|ota build)\b/i.test(String(normalized || ''))) {
    return null;
  }
  return answerFounderAlignedProductQuestion(message, readProductEvidenceSnapshot());
}

function maybeRouteProductLabScreenshotWorkflowPlan(normalized = '') {
  if (!isProductLabWorkflowScreenshotCommand(normalized)) return null;
  return {
    command: 'product_lab_screenshot_workflow_plan',
    details: { agent: 'cto', intent: 'product_lab_screenshot_workflow_plan' },
    matchedRoute: 'product_lab_screenshot_workflow',
    response: [
      'CTO: Product Lab screenshot should run in GitHub Actions, not on this PC.',
      'Execution path: build APK, boot emulator, install Aritenis, capture screenshot, upload product-lab-validation artifact.',
      'This is evidence collection only. No product code mutation starts.'
    ].join('\n')
  };
}

function maybeRouteProductLabLocalScreenshotPlan(message, normalized = normalizeMessage(message)) {
  if (!isProductLabScreenshotCommand(normalized || message)) return null;
  return buildScreenshotCaptureResponse({
    ok: true,
    filePath: 'capture pending in WhatsApp server async path',
    publicUrl: null,
    mediaUrls: []
  });
}

async function maybeRouteProductLabScreenshotWorkflow(normalized = '', options = {}) {
  if (!isProductLabWorkflowScreenshotCommand(normalized)) {
    return null;
  }
  const dispatch = await requestProductLabScreenshot({
    triggeredBy: 'whatsapp',
    fetchImpl: options.fetchImpl || fetch
  }, options.env || process.env);
  if (dispatch.status !== 'QUEUED') {
    return {
      command: 'product_lab_screenshot_workflow_config_required',
      details: { agent: 'cto', intent: 'product_lab_screenshot_workflow_config_required', dispatch },
      matchedRoute: 'product_lab_screenshot_workflow',
      response: [
        'CTO: Product Lab screenshot workflow was not queued.',
        `Reason: ${dispatch.message}`,
        'Needed on Render: GITHUB_ACTIONS_TOKEN.',
        'Optional override: GITHUB_REPOSITORY if the repo ever changes.',
        'Keep Twilio pointed at the Render webhook, not ngrok, when the PC may be off.'
      ].join('\n')
    };
  }

  return {
    command: 'product_lab_screenshot_workflow',
    details: { agent: 'cto', intent: 'product_lab_screenshot_workflow', dispatch },
    matchedRoute: 'product_lab_screenshot_workflow',
    response: [
      'CTO: Product Lab screenshot workflow queued on GitHub.',
      `Workflow: ${dispatch.workflow}`,
      `Runs: ${dispatch.runsUrl}`,
      `Artifact: ${dispatch.artifactName}`,
      'Expected output: emulator screenshot plus Product Lab reports.',
      'I will try to send the screenshot automatically when the run finishes.',
      'If it does not arrive, reply: latest screenshot',
      'No product code mutation started.'
    ].join('\n')
  };
}

function isProductLabWorkflowScreenshotCommand(normalized = '') {
  const text = String(normalized || '').trim().toLowerCase();
  return /^(screenshot|capture screenshot|send screenshot|take screenshot|keyboard screenshot|product lab screenshot|run product lab screenshot|github product lab screenshot|cloud screenshot|capture screenshot in github|run screenshot lab)$/.test(text);
}

async function maybeRouteProductLabScreenshotResult(normalized = '', options = {}) {
  if (!isLatestProductLabScreenshotRequest(normalized)) {
    return null;
  }
  const result = await fetchLatestProductLabScreenshot({
    root: options.root || process.cwd(),
    publicBaseUrl: options.publicBaseUrl || process.env.PUBLIC_BASE_URL || '',
    env: options.env || process.env,
    fetchImpl: options.fetchImpl || fetch
  });
  if (result.status === 'READY') {
    return {
      command: 'product_lab_screenshot_ready',
      details: { agent: 'cto', intent: 'product_lab_screenshot_ready', result },
      matchedRoute: 'product_lab_screenshot_result',
      response: [
        'CTO: Product Lab screenshot is ready.',
        `Run: ${result.runUrl}`,
        `Artifact: ${result.artifactName}`,
        result.publicUrl ? 'Image attached for WhatsApp review.' : 'Screenshot downloaded, but PUBLIC_BASE_URL is missing so WhatsApp cannot attach it yet.',
        'No product code mutation started.'
      ].join('\n'),
      mediaUrls: result.mediaUrls || []
    };
  }
  if (result.status === 'UNHEALTHY_SCREENSHOT') {
    return {
      command: 'product_lab_screenshot_unhealthy',
      details: { agent: 'cto', intent: 'product_lab_screenshot_unhealthy', result },
      matchedRoute: 'product_lab_screenshot_result',
      response: [
        'CTO: Product Lab screenshot was rejected.',
        'Reason: emulator/system dialog evidence appeared in the Product Lab artifact.',
        `Evidence: ${result.evidencePath}`,
        result.runUrl ? `Run: ${result.runUrl}` : '',
        'Action: no screenshot sent because it would be false product evidence.',
        'No product code mutation started.'
      ].filter(Boolean).join('\n')
    };
  }
  return {
    command: 'product_lab_screenshot_not_ready',
    details: { agent: 'cto', intent: 'product_lab_screenshot_not_ready', result },
    matchedRoute: 'product_lab_screenshot_result',
    response: [
      'CTO: Product Lab screenshot is not ready yet.',
      `Status: ${result.status}`,
      `Reason: ${result.message}`,
      result.runUrl ? `Run: ${result.runUrl}` : '',
      'No product code mutation started.'
    ].filter(Boolean).join('\n')
  };
}

async function maybeRouteProductLabLocalScreenshotCapture(message, normalized = normalizeMessage(message), options = {}) {
  if (!isProductLabScreenshotCommand(normalized || message)) return null;
  try {
    const capture = captureProductLabScreenshot({
      root: options.root || process.cwd(),
      publicBaseUrl: options.publicBaseUrl || process.env.PUBLIC_BASE_URL || '',
      ...(options.screenshotCapture || {})
    });
    return buildScreenshotCaptureResponse(capture);
  } catch (error) {
    return buildScreenshotCaptureResponse({
      ok: false,
      error: error.message
    });
  }
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

function buildEvidenceBackedPriorityAnswer(text) {
  const evidence = readProductEvidenceSnapshot();
  const architectureMentioned = /\barchitecture cleanup\b/.test(text);
  const swipeMentioned = /\bswipe trust\b/.test(text);
  const pressure = evidence.pressureReport;
  const archive = evidence.archive;
  const entries = Array.isArray(archive.entries) ? archive.entries : [];
  const highestPressure = extractReportValue(pressure, 'Highest current pressure') || 'not found in current report';
  const dangerousSubsystem = extractReportValue(pressure, 'Most dangerous subsystem') || 'not found in current report';
  const retentionRisk = extractReportValue(pressure, 'Biggest retention risk') || 'not found in current report';
  const unsafeProposals = extractReportValue(pressure, 'Currently unsafe proposals') || 'not found in current report';
  const hasAggregateEvidence = entries.length > 0;

  const recommendation = swipeMentioned
    ? 'swipe trust'
    : 'the highest Phase 1 trust pressure';

  const lines = [
    `CTO: Based on current product evidence, ${recommendation} should come before ${architectureMentioned ? 'architecture cleanup' : 'architecture work'}.`,
    `Evidence checked: PRODUCT_PRESSURE_REPORT.md, product-evidence-archive.json, governance state.`,
    `Current pressure report: ${highestPressure}.`,
    `Most dangerous subsystem: ${dangerousSubsystem}.`,
    `Retention risk: ${retentionRisk}.`
  ];

  if (!hasAggregateEvidence) {
    lines.push('Evidence gap: aggregate product evidence archive is still empty, so confidence is report-backed, not field-metrics-backed.');
  } else {
    lines.push(`Aggregate evidence entries reviewed: ${entries.length}.`);
  }

  lines.push(`Why not architecture first: ${unsafeProposals}.`);
  lines.push('Safe next action: inspect aggregate swipe-failure/correction signals and propose one bounded swipe-confidence experiment before any hot-path edit.');
  return lines;
}

function readProductEvidenceSnapshot() {
  return {
    archive: readJson(path.join(ROOT, 'ai-cto', 'product-evidence-archive.json'), { entries: [], trends: {} }),
    pressureReport: readText(path.join(ROOT, 'PRODUCT_PRESSURE_REPORT.md')),
    governanceState: readJson(path.join(ROOT, 'ai-cto', 'governance-state.json'), {})
  };
}

function extractReportValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(markdown || '').match(new RegExp(`${escaped}:\\s*([^\\n]+)`, 'i'));
  return match ? match[1].trim().replace(/\.$/, '') : null;
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(file) {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  } catch {
    return '';
  }
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

function maybeRouteRecentProductImprovements(message, options = {}) {
  if (!isProductImprovementQuestion(message)) return null;
  return {
    command: 'recent_product_improvements',
    details: {
      agent: 'cto',
      intent: 'recent_product_improvements',
      conversationMode: 'PROGRESS_REALITY',
      skipExecutionSchema: true
    },
    matchedRoute: 'git_grounded_product_improvements',
    response: buildRecentProductImprovementAnswer({
      root: options.root || ROOT
    })
  };
}

function isLatestProductLabScreenshotRequest(normalized = '') {
  const text = String(normalized || '').trim().toLowerCase();
  return /^(latest screenshot|send latest screenshot|screenshot result|product lab screenshot result)$/.test(text) ||
    /\b(send|show|get|fetch)\b/.test(text) &&
    /\b(latest|current)\b/.test(text) &&
    /\b(keyboard visual|keyboard screenshot|screenshot)\b/.test(text);
}

function isHardFoundationRewrite(normalized) {
  return /\brewrite\b/.test(String(normalized || '')) &&
    /\b(prediction|predictor|keyboardservice|keyboard|swipe|typing)\b/.test(String(normalized || ''));
}

function isProposalDiscussion(normalized) {
  return /\b(propose|proposal|experiment|micro-experiment|tiny experiment|should we)\b/.test(String(normalized || ''));
}

async function maybeRouteVisionDecision(message, options = {}) {
  const token = approvalTokenFromMessage(message);
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
    return {
      command: 'vision_command_approval_required',
      details: { agent: 'cto', intent: 'vision_command_plan', visionCommand: entry },
      matchedRoute: 'vision_command_review_required',
      response: formatVisionPlan(entry),
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

function maybeRouteFounderThinkingFirst(message, state, memory = {}) {
  const classification = classifyConversationRoute(message);
  if (!isFounderThinkingRoute(classification)) return null;

  const founderMind = routeFounderMindReconstruction(message, { root: ROOT, state, memory });
  if (!founderMind) return null;

  return {
    ...founderMind,
    details: {
      ...(founderMind.details || {}),
      conversationRoute: classification.route,
      conversationRouteConfidence: classification.confidence,
      conversationRouteReason: classification.reason,
      choseSingleConversationRoute: true,
      bypassedExecutionTemplates: true,
      skipExecutionSchema: true
    }
  };
}

function maybeRouteReinforcedConversation(message, state, memory = {}) {
  if (!shouldPreferReinforcedConversation(message, memory)) return null;
  const founderMind = routeFounderMindReconstruction(message, { root: ROOT, state, memory });
  if (!founderMind) return null;
  return {
    ...founderMind,
    details: {
      ...(founderMind.details || {}),
      reinforcementPreferred: true,
      reinforcementReason: 'historically successful founder conversation route',
      skipExecutionSchema: true
    }
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

function routeMessage(message, state, memory = {}) {
  const founderMemoryLayer = loadFounderMemoryLayer({ root: ROOT });
  const enrichedMemory = {
    ...memory,
    founderMemoryLayer
  };
  const routed = applyReinforcementPreferencesToRoute(
    applyReinforcementToRoute(routeMessageInternal(message, state, enrichedMemory), enrichedMemory),
    enrichedMemory
  );
  return enforceDeterministicResponse(enforceMemoryPolicyOnRoute(routed, {
    message,
    memory,
    founderMemoryLayer
  }), message, state);
}

async function routeMessageWithAi(message, state, memory = {}, options = {}) {
  const founderMemoryLayer = loadFounderMemoryLayer({ root: ROOT });
  const route = await routeMessageWithAiInternal(message, state, {
    ...memory,
    founderMemoryLayer
  }, options);
  const preferenceAdjusted = applyReinforcementPreferencesToRoute(route, {
    ...memory,
    founderMemoryLayer
  });
  return enforceDeterministicResponse(enforceMemoryPolicyOnRoute(preferenceAdjusted, {
    message,
    memory,
    founderMemoryLayer
  }), message, state);
}

function enforceDeterministicResponse(route, message, state = {}) {
  const antiTemplateRoute = enforceAntiTemplateOnRoute(route, { message, state });
  const userValueRoute = applyUserValueJudgeToRoute(antiTemplateRoute, { message });
  const disagreementRoute = applyIntelligentDisagreementToRoute(userValueRoute, { message });
  const qualityRoute = enforceInternalAnswerQuality(disagreementRoute, { message });
  if (qualityRoute && qualityRoute.details && qualityRoute.details.skipExecutionSchema) {
    return qualityRoute;
  }
  return enforceExecutionSchemaOnRoute(qualityRoute, {
    message,
    memorySources: memorySourcesFromResponse(qualityRoute && qualityRoute.response)
  });
}
