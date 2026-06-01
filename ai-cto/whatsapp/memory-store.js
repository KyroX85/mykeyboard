const fs = require('fs');
const path = require('path');
const {
  buildSemanticFounderState,
  rankProductPriorities,
  continuationPlan,
  buildOperationalIntelligence
} = require('./semantic-memory');
const {
  updateRouteReinforcement
} = require('./reinforcement-learning-layer');
const {
  updateFounderQuestionClusters
} = require('../founder-question-clustering');
const {
  compressFounderMemory
} = require('../memory-compression-layer');
const {
  extractFounderBeliefShift,
  updateFounderBeliefTracker
} = require('../founder-belief-tracker');
const {
  detectFounderContradiction,
  updateFounderContradictions
} = require('../founder-contradiction-detector');
const {
  shouldJudgeIdea,
  judgeUserValue,
  updateUserValueJudgments
} = require('../user-value-judge');
const {
  shouldRunPremortem,
  generatePremortem,
  updatePremortemMemory
} = require('../premortem-engine');
const {
  shouldEvaluateOpportunityCost,
  evaluateOpportunityCost,
  updateOpportunityCostMemory
} = require('../opportunity-cost-layer');
const {
  shouldEvaluateTruthOverAgreement,
  evaluateTruthOverAgreement,
  updateTruthOverAgreementMemory
} = require('../truth-over-agreement-layer');
const {
  shouldTrackFounderHypothesis,
  extractFounderHypothesis,
  updateFounderHypothesisMemory
} = require('../founder-hypothesis-tracker');
const {
  shouldPredictActionOutcome,
  generateActionPrediction,
  updatePredictionMemory
} = require('../prediction-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_FILE = process.env.ARITENIS_WHATSAPP_MEMORY_FILE ||
  path.join(ROOT, 'ai-cto', '.whatsapp_memory.json');
const MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_MEMORY = {
  version: '1.0',
  lastRequestedFocusArea: null,
  latestUnresolvedIssue: null,
  lastHealthScore: null,
  latestMomentumState: null,
  lastAgentInteraction: null,
  lastFocusTopic: null,
  activeTasks: [],
  currentSprintFocus: null,
  lastDiscussedTopic: null,
  lastUnfinishedConcern: null,
  lastMentionedBlocker: null,
  lastActiveTask: null,
  latestImprovement: null,
  latestWarning: null,
  lastFounderTone: null,
  lastDiscussedFrustration: null,
  unresolvedConcern: null,
  repeatedPainPoints: [],
  recentWins: [],
  founderPreferredWording: null,
  founderGoal: null,
  activeFocus: null,
  currentFrustration: null,
  unresolvedReference: null,
  desiredOutcome: null,
  lastRequestedAction: null,
  activeRuntimeProblem: null,
  blockedPriority: null,
  preferredResponseStyle: null,
  schoolMemoryStartedAt: null,
  semanticFounderState: null,
  productPriorities: [],
  contextConfidence: null,
  semanticConflicts: [],
  unresolvedTopics: [],
  operationalIntelligence: null,
  productFeelWins: [],
  regressionCauses: [],
  founderRejectedPatterns: [],
  frictionReducers: [],
  fakeProgressPatterns: [],
  founderConcerns: [],
  founderDoubts: [],
  founderDecisions: [],
  founderGoals: [],
  lastFounderConcern: null,
  nextContinuationAction: null,
  recentMessages: [],
  previousFounderQuestion: null,
  previousAgentAnswer: null,
  founderFeedback: [],
  lastFeedback: null,
  founderTasteModel: null,
  founderQuestionClusters: null,
  wrongAnswerAnalysis: null,
  compressedFounderInsights: [],
  memoryCompression: null,
  founderBeliefTracker: null,
  founderContradictions: null,
  userValueJudgments: null,
  premortemMemory: null,
  opportunityCostMemory: null,
  truthOverAgreementMemory: null,
  founderHypothesisTracker: null,
  predictionMemory: null,
  routeScores: {},
  reinforcementEvents: [],
  lastRouteForReward: null,
  lastReward: null,
  pendingAction: null,
  lastCommand: null,
  lastUpdatedAt: null
};

function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { ...DEFAULT_MEMORY };
    const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    const memory = { ...DEFAULT_MEMORY, ...parsed, version: DEFAULT_MEMORY.version };
    return cleanupStaleMemory(memory);
  } catch (error) {
    recoverCorruptMemory(error);
    return { ...DEFAULT_MEMORY };
  }
}

function writeMemory(memory) {
  const next = compressFounderMemory({
    ...DEFAULT_MEMORY,
    ...memory,
    version: DEFAULT_MEMORY.version,
    lastUpdatedAt: new Date().toISOString()
  });

  try {
    const tmp = `${MEMORY_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, MEMORY_FILE);
  } catch {
    return readMemory();
  }

  return next;
}

function cleanupStaleMemory(memory) {
  if (!memory.lastUpdatedAt) return memory;
  const updatedAt = Date.parse(memory.lastUpdatedAt);
  if (!Number.isFinite(updatedAt)) return { ...DEFAULT_MEMORY };
  if (Date.now() - updatedAt <= MEMORY_TTL_MS) return memory;
  return writeMemory({
    ...DEFAULT_MEMORY,
    lastHealthScore: memory.lastHealthScore,
    latestMomentumState: memory.latestMomentumState
  });
}

function recoverCorruptMemory(error) {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(MEMORY_FILE, `${MEMORY_FILE}.corrupt-${timestamp}`);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
      ...DEFAULT_MEMORY,
      recoveredAt: new Date().toISOString(),
      recoveryReason: `Invalid JSON: ${error.message}`
    }, null, 2));
  } catch {
    // Memory recovery must not block webhook responses.
  }
}

function updateMemory(command, state, details = {}) {
  const memory = readMemory();
  const sections = state.sections || {};
  const latestUnresolvedIssue =
    first(sections.unresolved) ||
    first(sections.risks) ||
    memory.latestUnresolvedIssue ||
    null;
  const pendingAction =
    details.pendingAction ||
    first(sections.nextPriority) ||
    first(sections.safestOpportunity) ||
    first(sections.approvals) ||
    memory.pendingAction ||
    null;
  const continuityEntry = buildFounderContinuityEntry(details);
  const reinforcement = updateRouteReinforcement(memory, command, details);
  const founderQuestionClusters = updateQuestionClustersIfNeeded(memory.founderQuestionClusters, details);
  const founderBeliefTracker = updateBeliefTrackerIfNeeded(memory.founderBeliefTracker, details);
  const founderContradictions = updateContradictionsIfNeeded(memory.founderContradictions, {
    ...details,
    founderBeliefTracker: details.founderBeliefTracker || memory.founderBeliefTracker
  });
  const userValueJudgments = updateUserValueIfNeeded(memory.userValueJudgments, details);
  const premortemMemory = updatePremortemIfNeeded(memory.premortemMemory, details);
  const opportunityCostMemory = updateOpportunityCostIfNeeded(memory.opportunityCostMemory, details);
  const truthOverAgreementMemory = updateTruthOverAgreementIfNeeded(memory.truthOverAgreementMemory, details);
  const founderHypothesisTracker = updateFounderHypothesisIfNeeded(memory.founderHypothesisTracker, details);
  const predictionMemory = updatePredictionIfNeeded(memory.predictionMemory, details);

  return writeMemory({
    ...memory,
    ...reinforcement,
    lastCommand: command,
    recentMessages: rememberMessage(memory.recentMessages, {
      role: 'agent',
      intent: command,
      founderMessage: details.founderMessage || null,
      agentAnswer: details.agentAnswer ? String(details.agentAnswer).slice(0, 1200) : null,
      pendingAction,
      summary: `Command handled: ${command}`
    }),
    lastRequestedFocusArea: details.focusTopic || memory.lastRequestedFocusArea,
    latestUnresolvedIssue,
    lastHealthScore: state.healthScore == null ? memory.lastHealthScore : state.healthScore,
    latestMomentumState: state.momentum || memory.latestMomentumState,
    previousFounderQuestion: details.founderMessage || memory.previousFounderQuestion || null,
    previousAgentAnswer: details.agentAnswer ? String(details.agentAnswer).slice(0, 1200) : memory.previousAgentAnswer || null,
    pendingAction,
    lastDiscussedTopic: details.topic || details.intent || memory.lastDiscussedTopic || null,
    founderConcerns: mergeContinuity(memory.founderConcerns, continuityEntry),
    founderDoubts: continuityEntry && ['DOUBT', 'FRUSTRATION', 'STRATEGIC_DISCUSSION'].includes(continuityEntry.category)
      ? mergeContinuity(memory.founderDoubts, continuityEntry)
      : boundedContinuity(memory.founderDoubts),
    founderGoals: continuityEntry && ['VISION', 'FOUNDER_QUESTION'].includes(continuityEntry.category)
      ? mergeContinuity(memory.founderGoals, continuityEntry)
      : boundedContinuity(memory.founderGoals),
    founderDecisions: boundedContinuity(memory.founderDecisions),
    lastFounderConcern: continuityEntry || memory.lastFounderConcern || null,
    founderQuestionClusters,
    founderBeliefTracker,
    founderContradictions,
    userValueJudgments,
    premortemMemory,
    opportunityCostMemory,
    truthOverAgreementMemory,
    founderHypothesisTracker,
    predictionMemory
  });
}

function readConversationMemory() {
  const memory = readMemory();
  return {
    ...memory,
    lastAgentInteraction: memory.lastAgentInteraction || null,
    lastFocusTopic: memory.lastFocusTopic || memory.lastRequestedFocusArea || null,
    activeTasks: Array.isArray(memory.activeTasks) ? memory.activeTasks : [],
    currentSprintFocus: memory.currentSprintFocus || memory.lastRequestedFocusArea || null,
    lastDiscussedTopic: memory.lastDiscussedTopic || memory.lastFocusTopic || null,
    lastUnfinishedConcern: memory.lastUnfinishedConcern || memory.latestUnresolvedIssue || null,
    lastMentionedBlocker: memory.lastMentionedBlocker || null,
    lastActiveTask: memory.lastActiveTask || null,
    latestImprovement: memory.latestImprovement || null,
    latestWarning: memory.latestWarning || null,
    lastFounderTone: memory.lastFounderTone || null,
    lastDiscussedFrustration: memory.lastDiscussedFrustration || null,
    unresolvedConcern: memory.unresolvedConcern || memory.latestUnresolvedIssue || null,
    repeatedPainPoints: Array.isArray(memory.repeatedPainPoints) ? memory.repeatedPainPoints : [],
    recentWins: Array.isArray(memory.recentWins) ? memory.recentWins : [],
    founderPreferredWording: memory.founderPreferredWording || null,
    founderGoal: memory.founderGoal || null,
    activeFocus: memory.activeFocus || memory.lastFocusTopic || null,
    currentFrustration: memory.currentFrustration || null,
    unresolvedReference: memory.unresolvedReference || memory.unresolvedConcern || memory.latestUnresolvedIssue || null,
    desiredOutcome: memory.desiredOutcome || null,
    lastRequestedAction: memory.lastRequestedAction || null,
    activeRuntimeProblem: memory.activeRuntimeProblem || null,
    blockedPriority: memory.blockedPriority || null,
    preferredResponseStyle: memory.preferredResponseStyle || null,
    schoolMemoryStartedAt: memory.schoolMemoryStartedAt || memory.lastUpdatedAt || null,
    semanticFounderState: memory.semanticFounderState || null,
    productPriorities: Array.isArray(memory.productPriorities) ? memory.productPriorities : [],
    contextConfidence: memory.contextConfidence == null ? null : memory.contextConfidence,
    semanticConflicts: Array.isArray(memory.semanticConflicts) ? memory.semanticConflicts : [],
    unresolvedTopics: Array.isArray(memory.unresolvedTopics) ? memory.unresolvedTopics : [],
    operationalIntelligence: memory.operationalIntelligence || null,
    productFeelWins: Array.isArray(memory.productFeelWins) ? memory.productFeelWins : [],
    regressionCauses: Array.isArray(memory.regressionCauses) ? memory.regressionCauses : [],
    founderRejectedPatterns: Array.isArray(memory.founderRejectedPatterns) ? memory.founderRejectedPatterns : [],
    frictionReducers: Array.isArray(memory.frictionReducers) ? memory.frictionReducers : [],
    fakeProgressPatterns: Array.isArray(memory.fakeProgressPatterns) ? memory.fakeProgressPatterns : [],
    founderConcerns: Array.isArray(memory.founderConcerns) ? memory.founderConcerns.slice(0, 10) : [],
    founderDoubts: Array.isArray(memory.founderDoubts) ? memory.founderDoubts.slice(0, 10) : [],
    founderDecisions: Array.isArray(memory.founderDecisions) ? memory.founderDecisions.slice(0, 10) : [],
    founderGoals: Array.isArray(memory.founderGoals) ? memory.founderGoals.slice(0, 10) : [],
    lastFounderConcern: memory.lastFounderConcern || null,
    nextContinuationAction: memory.nextContinuationAction || null,
    recentMessages: Array.isArray(memory.recentMessages) ? memory.recentMessages.slice(0, 10) : []
    ,
    previousFounderQuestion: memory.previousFounderQuestion || null,
    previousAgentAnswer: memory.previousAgentAnswer || null,
    founderFeedback: Array.isArray(memory.founderFeedback) ? memory.founderFeedback.slice(0, 50) : [],
    lastFeedback: memory.lastFeedback || null,
    founderTasteModel: memory.founderTasteModel || null,
    founderQuestionClusters: memory.founderQuestionClusters || null,
    wrongAnswerAnalysis: memory.wrongAnswerAnalysis || null,
    compressedFounderInsights: Array.isArray(memory.compressedFounderInsights) ? memory.compressedFounderInsights.slice(0, 5) : [],
    memoryCompression: memory.memoryCompression || null,
    founderBeliefTracker: memory.founderBeliefTracker || null,
    founderContradictions: memory.founderContradictions || null,
    userValueJudgments: memory.userValueJudgments || null,
    premortemMemory: memory.premortemMemory || null,
    opportunityCostMemory: memory.opportunityCostMemory || null,
    truthOverAgreementMemory: memory.truthOverAgreementMemory || null,
    founderHypothesisTracker: memory.founderHypothesisTracker || null,
    predictionMemory: memory.predictionMemory || null,
    routeScores: memory.routeScores && typeof memory.routeScores === 'object' ? memory.routeScores : {},
    reinforcementEvents: Array.isArray(memory.reinforcementEvents) ? memory.reinforcementEvents.slice(0, 80) : [],
    lastRouteForReward: memory.lastRouteForReward || null,
    lastReward: memory.lastReward || null,
    pendingAction: memory.pendingAction || memory.nextContinuationAction || null
  };
}

function updateConversationMemory(route, state) {
  const memory = readConversationMemory();
  const details = route || {};
  const sections = state.sections || {};
  const changed = state.changed || {};
  const continuity = route.continuity || {};
  const directive = route.directive || continuity.directive || null;
  const activeTasks = deriveActiveTasks(state);
  const semanticFounderState = buildSemanticFounderState({
    agent: route.agent,
    intent: route.intent,
    topic: route.focusTopic,
    state,
    priorMemory: {
      ...memory,
      currentContinuity: continuity
    }
  });
  const productPriorities = rankProductPriorities(state, semanticFounderState);
  const nextContinuationAction = continuationPlan(state, semanticFounderState);
  const operationalIntelligence = buildOperationalIntelligence(state, semanticFounderState, memory);
  const continuityEntry = buildFounderContinuityEntry(route);
  const reinforcement = updateRouteReinforcement(memory, route.command || route.intent || 'agent', route);
  const founderQuestionClusters = updateQuestionClustersIfNeeded(memory.founderQuestionClusters, route);
  const founderBeliefTracker = updateBeliefTrackerIfNeeded(memory.founderBeliefTracker, route);
  const founderContradictions = updateContradictionsIfNeeded(memory.founderContradictions, {
    ...route,
    founderBeliefTracker: route.founderBeliefTracker || memory.founderBeliefTracker
  });
  const userValueJudgments = updateUserValueIfNeeded(memory.userValueJudgments, route);
  const premortemMemory = updatePremortemIfNeeded(memory.premortemMemory, route);
  const opportunityCostMemory = updateOpportunityCostIfNeeded(memory.opportunityCostMemory, route);
  const truthOverAgreementMemory = updateTruthOverAgreementIfNeeded(memory.truthOverAgreementMemory, route);
  const founderHypothesisTracker = updateFounderHypothesisIfNeeded(memory.founderHypothesisTracker, route);
  const predictionMemory = updatePredictionIfNeeded(memory.predictionMemory, route);
  const next = {
    ...memory,
    ...reinforcement,
    lastAgentInteraction: route.agent || memory.lastAgentInteraction,
    lastFocusTopic: route.focusTopic || memory.lastFocusTopic,
    lastRequestedFocusArea: route.focusTopic || memory.lastRequestedFocusArea,
    latestUnresolvedIssue: first(sections.unresolved) || first(sections.risks) || memory.latestUnresolvedIssue || null,
    lastHealthScore: state.healthScore == null ? memory.lastHealthScore : state.healthScore,
    latestMomentumState: state.momentum || memory.latestMomentumState,
    previousFounderQuestion: details.founderMessage || memory.previousFounderQuestion || null,
    previousAgentAnswer: details.agentAnswer ? String(details.agentAnswer).slice(0, 1200) : memory.previousAgentAnswer || null,
    pendingAction: details.pendingAction || first(sections.nextPriority) || first(sections.approvals) || memory.pendingAction || null,
    activeTasks,
    currentSprintFocus: route.focusTopic || first(sections.nextPriority) || memory.currentSprintFocus || null,
    lastDiscussedTopic: route.focusTopic || route.intent || memory.lastDiscussedTopic || null,
    lastUnfinishedConcern: first(sections.unresolved) || first(sections.risks) || memory.lastUnfinishedConcern || null,
    lastMentionedBlocker: first(sections.repeatedFailures) || memory.lastMentionedBlocker || null,
    lastActiveTask: activeTasks[0] || memory.lastActiveTask || null,
    latestImprovement: first(sections.completedFixes) || first(changed.completed) || memory.latestImprovement || null,
    latestWarning: first(sections.risks) || first(changed.newRisks) || memory.latestWarning || null,
    lastFounderTone: continuity.founderTone || memory.lastFounderTone || null,
    lastDiscussedFrustration: continuity.frustration || memory.lastDiscussedFrustration || null,
    unresolvedConcern: first(sections.unresolved) || first(sections.risks) || memory.unresolvedConcern || null,
    repeatedPainPoints: mergeRemembered(memory.repeatedPainPoints, continuity.painPoint),
    recentWins: mergeRemembered(memory.recentWins, first(sections.completedFixes) || first(changed.completed)),
    founderPreferredWording: continuity.preferredWording || memory.founderPreferredWording || null,
    founderGoal: semanticFounderState.founderGoal,
    activeFocus: semanticFounderState.activeFocus,
    currentFrustration: semanticFounderState.currentFrustration,
    unresolvedReference: semanticFounderState.unresolvedReference,
    desiredOutcome: semanticFounderState.desiredOutcome,
    lastRequestedAction: semanticFounderState.lastRequestedAction,
    activeRuntimeProblem: semanticFounderState.activeRuntimeProblem,
    blockedPriority: semanticFounderState.blockedPriority,
    preferredResponseStyle: semanticFounderState.preferredResponseStyle,
    schoolMemoryStartedAt: memory.schoolMemoryStartedAt || memory.lastUpdatedAt || new Date().toISOString(),
    semanticFounderState,
    productPriorities,
    contextConfidence: semanticFounderState.contextConfidence,
    semanticConflicts: semanticFounderState.semanticConflicts,
    unresolvedTopics: semanticFounderState.unresolvedTopics,
    operationalIntelligence,
    founderConcerns: mergeContinuity(memory.founderConcerns, continuityEntry),
    founderDoubts: continuityEntry && ['DOUBT', 'FRUSTRATION', 'STRATEGIC_DISCUSSION'].includes(continuityEntry.category)
      ? mergeContinuity(memory.founderDoubts, continuityEntry)
      : boundedContinuity(memory.founderDoubts),
    founderGoals: continuityEntry && ['VISION', 'FOUNDER_QUESTION'].includes(continuityEntry.category)
      ? mergeContinuity(memory.founderGoals, continuityEntry)
      : boundedContinuity(memory.founderGoals),
    founderDecisions: boundedContinuity(memory.founderDecisions),
    lastFounderConcern: continuityEntry || memory.lastFounderConcern || null,
    nextContinuationAction,
    founderQuestionClusters,
    founderBeliefTracker,
    founderContradictions,
    userValueJudgments,
    premortemMemory,
    opportunityCostMemory,
    truthOverAgreementMemory,
    founderHypothesisTracker,
    predictionMemory,
    recentMessages: rememberMessage(memory.recentMessages, {
      role: 'agent',
      agent: route.agent || 'cto',
      intent: route.intent,
      topic: route.focusTopic || null,
      targetAgent: directive ? directive.targetAgent : null,
      action: directive ? directive.action : null,
      directive: directive || null,
      founderMessage: continuity.normalized || null,
      summary: summarizeRouteMemory(route, state)
    }),
    lastCommand: `agent:${route.agent}:${route.intent}`
  };
  return writeMemory(next);
}

function rememberMessage(items, entry) {
  const list = Array.isArray(items) ? items : [];
  return [{
    timestamp: new Date().toISOString(),
    ...entry
  }, ...list].slice(0, 10);
}

function summarizeRouteMemory(route, state) {
  const directive = route.directive || (route.continuity && route.continuity.directive) || null;
  if (route.intent === 'directive' && directive) {
    return `CTO assigned ${directive.targetAgent} to ${String(directive.action || 'follow instruction').replace(/_/g, ' ')}.`;
  }
  if (route.intent === 'recent_fix_question') return first(state.sections.completedFixes) || 'Asked about recent fixes.';
  if (route.intent === 'summary') return first(state.sections.risks) || first(state.sections.unresolved) || 'Shared team status.';
  if (route.intent === 'praise') return 'Founder praised the team.';
  if (route.intent === 'direction') return first(state.sections.nextPriority) || 'Founder asked for next steps.';
  if (route.focusTopic) return `Discussed ${route.focusTopic}.`;
  return `Handled ${route.intent || 'conversation'}.`;
}

function deriveActiveTasks(state) {
  const sections = state.sections || {};
  return [
    ...(Array.isArray(sections.nextPriority) ? sections.nextPriority : []),
    ...(Array.isArray(sections.approvals) ? sections.approvals : []),
    ...(Array.isArray(sections.completedFixes) ? sections.completedFixes : [])
  ]
    .filter(Boolean)
    .slice(0, 5);
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function mergeRemembered(items, value) {
  const list = Array.isArray(items) ? items : [];
  if (!value) return list.slice(0, 5);
  return [value, ...list.filter((item) => item !== value)].slice(0, 5);
}

function buildFounderContinuityEntry(details = {}) {
  const mind = details.mindReconstruction;
  if (!mind || typeof mind !== 'object') return null;
  const category = details.category || mind.category || details.intent || 'FOUNDER_CONCERN';
  return {
    timestamp: new Date().toISOString(),
    category,
    objective: mind.objective || null,
    assumption: mind.assumption || null,
    concern: mind.concern || null,
    decision: mind.decision || null,
    desiredOutcome: mind.desiredOutcome || null,
    actualQuestion: mind.actualQuestion || null,
    founderMessage: details.founderMessage || null,
    confidence: details.confidence || null
  };
}

function updateQuestionClustersIfNeeded(existing, details = {}) {
  if (!details || !details.founderMessage || !details.questionCluster) {
    return existing || null;
  }
  return updateFounderQuestionClusters(existing, {
    message: details.founderMessage,
    questionCluster: details.questionCluster,
    category: details.category || (details.mindReconstruction && details.mindReconstruction.category) || null,
    intent: details.intent || null,
    confidence: details.confidence || (details.questionCluster && details.questionCluster.confidence) || null
  });
}

function updateBeliefTrackerIfNeeded(existing, details = {}) {
  if (!details || !details.founderMessage) return existing || null;
  const shift = extractFounderBeliefShift(details);
  if (!shift) return existing || null;
  return updateFounderBeliefTracker(existing, shift);
}

function updateContradictionsIfNeeded(existing, details = {}) {
  if (!details || !details.founderMessage) return existing || null;
  const contradiction = detectFounderContradiction({
    founderMessage: details.founderMessage,
    details,
    memory: {
      founderBeliefTracker: details.founderBeliefTracker
    }
  });
  if (!contradiction) return existing || null;
  return updateFounderContradictions(existing, contradiction);
}

function updateUserValueIfNeeded(existing, details = {}) {
  const idea = details && (details.idea || details.proposal || details.founderMessage || details.agentAnswer);
  if (!shouldJudgeIdea(idea)) return existing || null;
  const judgment = judgeUserValue(idea, details);
  return updateUserValueJudgments(existing, judgment);
}

function updatePremortemIfNeeded(existing, details = {}) {
  const decision = details && (details.decision || details.idea || details.proposal || details.founderMessage || details.agentAnswer);
  if (!shouldRunPremortem(decision, details)) return existing || null;
  const premortem = generatePremortem(decision, details);
  return updatePremortemMemory(existing, premortem);
}

function updateOpportunityCostIfNeeded(existing, details = {}) {
  const initiative = details && (details.initiative || details.decision || details.idea || details.proposal || details.founderMessage || details.agentAnswer);
  if (!shouldEvaluateOpportunityCost(initiative, details)) return existing || null;
  const opportunityCost = evaluateOpportunityCost(initiative, details);
  return updateOpportunityCostMemory(existing, opportunityCost);
}

function updateTruthOverAgreementIfNeeded(existing, details = {}) {
  const message = details && (details.founderMessage || details.idea || details.proposal || details.decision || details.agentAnswer);
  if (!shouldEvaluateTruthOverAgreement(message, details)) return existing || null;
  const truthCheck = evaluateTruthOverAgreement(message, details);
  return updateTruthOverAgreementMemory(existing, truthCheck);
}

function updateFounderHypothesisIfNeeded(existing, details = {}) {
  const message = details && (details.founderMessage || details.agentAnswer || details.idea || details.proposal);
  if (!shouldTrackFounderHypothesis(message, details)) return existing || null;
  const hypothesis = extractFounderHypothesis(details);
  return updateFounderHypothesisMemory(existing, hypothesis);
}

function updatePredictionIfNeeded(existing, details = {}) {
  const action = details && (details.action || details.decision || details.initiative || details.idea || details.proposal || details.founderMessage || details.agentAnswer);
  if (!shouldPredictActionOutcome(action, details)) return existing || null;
  const prediction = generateActionPrediction(action, details);
  return updatePredictionMemory(existing, prediction);
}

function mergeContinuity(items, entry) {
  const list = boundedContinuity(items);
  if (!entry) return list;
  const key = continuityKey(entry);
  return [
    entry,
    ...list.filter((item) => continuityKey(item) !== key)
  ].slice(0, 10);
}

function boundedContinuity(items) {
  return Array.isArray(items) ? items.filter(Boolean).slice(0, 10) : [];
}

function continuityKey(entry = {}) {
  return String(entry.actualQuestion || entry.concern || entry.objective || '').toLowerCase();
}

module.exports = {
  readMemory,
  writeMemory,
  updateMemory,
  readConversationMemory,
  updateConversationMemory,
  deriveActiveTasks,
  rememberMessage,
  MEMORY_FILE
};
