const {
  readMemory,
  writeMemory,
  readConversationMemory
} = require('./memory-store');
const {
  updateFounderTasteModel
} = require('../founder-taste-model');
const {
  analyzeWrongAnswer,
  updateWrongAnswerMemory
} = require('../wrong-answer-analyzer');

const MAX_FEEDBACK_ITEMS = 50;

const FEEDBACK_PATTERNS = [
  {
    feedback: 'good_answer',
    polarity: 'positive',
    pattern: /\b(good answer|great answer|useful answer|that'?s useful|this is useful|correct|right|yes this|exactly)\b/i,
    confidence: 88,
    adaptation: 'preserve_direct_reasoning'
  },
  {
    feedback: 'wrong',
    polarity: 'negative',
    pattern: /\b(wrong|incorrect|not correct|bad answer)\b/i,
    confidence: 88,
    adaptation: 'reconstruct_before_answering'
  },
  {
    feedback: 'not_relevant',
    polarity: 'negative',
    pattern: /\b(not relevant|irrelevant|you didn'?t answer|did not answer|not what i asked)\b/i,
    confidence: 90,
    adaptation: 'answer_actual_question_first'
  },
  {
    feedback: 'too_generic',
    polarity: 'negative',
    pattern: /\b(too generic|generic answer|vague|too vague|not specific)\b/i,
    confidence: 86,
    adaptation: 'add_specific_product_test'
  },
  {
    feedback: 'too_tactical',
    polarity: 'negative',
    pattern: /\b(too tactical|too implementation|too much implementation|too low level)\b/i,
    confidence: 84,
    adaptation: 'raise_to_strategy'
  },
  {
    feedback: 'too_optimistic',
    polarity: 'negative',
    pattern: /\b(too optimistic|over optimistic|too positive|too much optimism|too reassuring)\b/i,
    confidence: 84,
    adaptation: 'state_uncertainty_and_risk'
  },
  {
    feedback: 'too_much_cto_mode',
    polarity: 'negative',
    pattern: /\b(too much cto mode|too cto|too much status|too operational|too much report|stop cto mode)\b/i,
    confidence: 86,
    adaptation: 'stay_conversational'
  },
  {
    feedback: 'too_philosophical',
    polarity: 'negative',
    pattern: /\b(too philosophical|too abstract|too much philosophy|too theoretical)\b/i,
    confidence: 84,
    adaptation: 'ground_in_user_value'
  },
  {
    feedback: 'neutral_reaction',
    polarity: 'neutral',
    pattern: /\b(mixed answer|not sure|maybe|unclear|partly|partially|somewhat|neutral)\b/i,
    confidence: 70,
    adaptation: 'watch_for_followup'
  }
];

function classifyFounderFeedback(message = '') {
  const text = String(message || '').trim();
  if (!text) return null;
  if (!looksLikeFeedbackUtterance(text)) return null;
  const match = FEEDBACK_PATTERNS.find((item) => item.pattern.test(text));
  if (!match) return null;
  return {
    feedback: match.feedback,
    polarity: match.polarity,
    confidence: match.confidence,
    adaptation: match.adaptation,
    sourceMessage: text
  };
}

function looksLikeFeedbackUtterance(text = '') {
  const value = String(text || '').trim().toLowerCase();
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= 5 && FEEDBACK_PATTERNS.some((item) => item.pattern.test(value))) {
    return true;
  }
  return /\b(your|that|this|the)\s+(answer|response|reply)\b/i.test(value) ||
    /\byou\s+(were|are|sound|sounded|answered)\b/i.test(value) ||
    /\bthat\s+(was|is)\b/i.test(value);
}

function maybeRouteFounderFeedback(message = '', memory = {}) {
  const classification = classifyFounderFeedback(message);
  if (!classification) return null;

  const entry = recordFounderFeedback(message, memory, classification);
  const founderTasteModel = readConversationMemory().founderTasteModel;
  return {
    command: 'founder_feedback_recorded',
    matchedRoute: 'founder_feedback_learning_layer',
    details: {
      agent: 'cto',
      intent: 'founder_feedback',
      feedback: entry.feedback,
      polarity: entry.polarity,
      confidence: entry.confidence,
      feedbackLearningApplied: true,
      skipExecutionSchema: true
    },
    response: [
      'Feedback recorded.',
      `Learned: ${formatAdaptation(entry.adaptation)}.`,
      formatFailureAnalysis(entry.wrongAnswerAnalysis),
      `Taste profile: ${formatTasteProfile(founderTasteModel)}.`,
      `Applies to: ${entry.questionPattern || 'previous founder exchange unavailable'}.`,
      'No execution started.'
    ].join('\n')
  };
}

function recordFounderFeedback(message = '', providedMemory = {}, classification = classifyFounderFeedback(message)) {
  if (!classification) return null;
  const conversationMemory = readConversationMemory();
  const memory = {
    ...conversationMemory,
    ...providedMemory
  };
  const previous = resolvePreviousExchange(memory);
  const routeUsed = resolvePreviousRoute(memory);
  const current = readMemory();
  const entry = {
    timestamp: new Date().toISOString(),
    feedback: classification.feedback,
    polarity: classification.polarity,
    confidence: classification.confidence,
    adaptation: classification.adaptation,
    sourceMessage: classification.sourceMessage,
    founderReaction: {
      label: classification.feedback,
      polarity: classification.polarity,
      confidence: classification.confidence,
      sourceMessage: classification.sourceMessage
    },
    questionPattern: normalizePattern(previous.question),
    answerPattern: normalizePattern(previous.answer),
    answerStyle: extractAnswerStyle(previous.answer),
    routeUsed,
    rawQuestionPreview: preview(previous.question),
    rawAnswerPreview: preview(previous.answer)
  };

  const wrongAnswerAnalysis = analyzeWrongAnswer(entry);
  const analyzedEntry = enrichFeedbackOutcome(entry, wrongAnswerAnalysis);
  const existing = Array.isArray(current.founderFeedback) ? current.founderFeedback : [];
  const nextFeedback = [analyzedEntry, ...existing].slice(0, MAX_FEEDBACK_ITEMS);
  const founderTasteModel = updateFounderTasteModel(current.founderTasteModel, analyzedEntry);
  const wrongAnswerMemory = updateWrongAnswerMemory(current.wrongAnswerAnalysis, wrongAnswerAnalysis);
  const routeScores = updateRouteScoresFromFeedback(current.routeScores, analyzedEntry);
  const reinforcementEvents = updateReinforcementEventsFromFeedback(current.reinforcementEvents, routeScores, analyzedEntry);
  const questionPatternRouteScores = updateQuestionPatternRouteScores(current.questionPatternRouteScores, analyzedEntry);
  writeMemory({
    ...current,
    routeScores,
    reinforcementEvents,
    questionPatternRouteScores,
    founderFeedback: nextFeedback,
    lastFeedback: analyzedEntry,
    founderTasteModel,
    wrongAnswerAnalysis: wrongAnswerMemory
  });
  return analyzedEntry;
}

function enrichFeedbackOutcome(entry = {}, wrongAnswerAnalysis = null) {
  if (entry.polarity === 'positive') {
    return {
      ...entry,
      successReason: buildSuccessReason(entry)
    };
  }
  if (entry.polarity === 'negative') {
    return {
      ...entry,
      wrongAnswerAnalysis,
      failureReason: buildFailureReason(entry, wrongAnswerAnalysis)
    };
  }
  return entry;
}

function applyFounderFeedbackToResponse(response = '', context = {}) {
  const guidance = buildFounderFeedbackGuidance(context.message, context.memory);
  if (!guidance.feedbackUsed.length &&
    !guidance.dominantNegativeStyles.length &&
    !guidance.preferredAnswerStyles.length &&
    !guidance.avoidedAnswerStyles.length) {
    return response;
  }

  const relevant = guidance.feedbackUsed;
  const strongest = relevant[0] || guidance.dominantNegativeStyles[0];
  if (!strongest || strongest.polarity === 'positive') {
    return applyPreferredAnswerStyle(response, guidance);
  }

  const cleanedResponse = applyPreferredAnswerStyle(stripRejectedTemplateLines(response, guidance), guidance);
  const adaptationLine = buildAdaptationLine(strongest);
  if (!adaptationLine || String(cleanedResponse).includes(adaptationLine)) {
    return cleanedResponse;
  }

  return [String(cleanedResponse || '').trim(), '', adaptationLine].filter(Boolean).join('\n');
}

function buildFounderFeedbackGuidance(message = '', memory = {}) {
  const source = Array.isArray(memory && memory.founderFeedback)
    ? memory.founderFeedback
    : readConversationMemory().founderFeedback || [];
  const relevant = findRelevantFounderFeedback(message, { founderFeedback: source });
  const sourceCounts = countFeedbackPolarities(source);
  const adaptationCounts = countBy(source.filter((entry) => entry && entry.polarity === 'negative'), 'adaptation');
  const repeatedNegative = Object.entries(adaptationCounts)
    .filter(([, count]) => count >= 2)
    .map(([adaptation]) => source.find((entry) => entry && entry.adaptation === adaptation && entry.polarity === 'negative'))
    .filter(Boolean);
  const successfulStyleExamples = source
    .filter((entry) => entry && entry.polarity === 'positive')
    .filter((entry) => labelsFromFeedbackEntry(entry).length)
    .slice(0, 5);
  const feedbackUsed = dedupeFeedback([...relevant, ...repeatedNegative]).slice(0, 5);
  const rejectedStyles = unique(feedbackUsed
    .filter((entry) => entry.polarity === 'negative')
    .map((entry) => styleRejectedBy(entry))
    .filter(Boolean));
  const preferredAnswerStyles = unique([...feedbackUsed, ...successfulStyleExamples]
    .filter((entry) => entry.polarity === 'positive')
    .flatMap((entry) => labelsFromFeedbackEntry(entry))
    .filter(Boolean));
  const avoidedAnswerStyles = unique(feedbackUsed
    .filter((entry) => entry.polarity === 'negative')
    .flatMap((entry) => labelsFromFeedbackEntry(entry))
    .filter(Boolean));
  const preferredAdaptations = unique(feedbackUsed
    .map((entry) => entry.adaptation)
    .filter(Boolean));
  const averageConfidence = feedbackUsed.length
    ? feedbackUsed.reduce((sum, entry) => sum + Number(entry.confidence || 0), 0) / feedbackUsed.length
    : 0;

  return {
    version: '1.0',
    feedbackUsed,
    dominantNegativeStyles: repeatedNegative,
    rejectedStyles,
    preferredAnswerStyles,
    avoidedAnswerStyles,
    preferredAdaptations,
    sourceCounts,
    confidence: Math.min(90, Math.round(averageConfidence || 0))
  };
}

function findRelevantFounderFeedback(message = '', memory = {}) {
  const source = Array.isArray(memory && memory.founderFeedback)
    ? memory.founderFeedback
    : readConversationMemory().founderFeedback || [];
  const text = normalizePattern(message);
  return source
    .map((entry) => ({
      ...entry,
      relevance: feedbackRelevance(text, entry)
    }))
    .filter((entry) => entry.relevance >= 0.18)
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0);
    })
    .slice(0, 3);
}

function resolvePreviousExchange(memory = {}) {
  const recent = Array.isArray(memory.recentMessages) ? memory.recentMessages : [];
  const direct = {
    question: memory.previousFounderQuestion || null,
    answer: memory.previousAgentAnswer || null
  };
  if (direct.question || direct.answer) return direct;

  const item = recent.find((entry) => entry && (entry.founderMessage || entry.agentAnswer));
  return {
    question: item && item.founderMessage ? item.founderMessage : null,
    answer: item && item.agentAnswer ? item.agentAnswer : null
  };
}

function resolvePreviousRoute(memory = {}) {
  const target = memory.lastRouteForReward || {};
  const recent = Array.isArray(memory.recentMessages) ? memory.recentMessages : [];
  const recentRoute = recent.find((entry) => entry && (entry.intent || entry.agent));
  const key = target.key || routeKeyFromRecent(recentRoute);
  if (!key) {
    return {
      key: 'unknown',
      command: null,
      matchedRoute: null,
      intent: null,
      category: null
    };
  }
  return {
    key,
    command: target.command || (recentRoute && recentRoute.intent) || null,
    matchedRoute: target.matchedRoute || null,
    intent: target.intent || (recentRoute && recentRoute.intent) || null,
    category: target.category || null
  };
}

function routeKeyFromRecent(recentRoute = null) {
  if (!recentRoute) return null;
  if (recentRoute.intent === 'founder_mind_reconstruction') return 'founder_mind_reconstruction';
  if (recentRoute.agent && recentRoute.intent) return `agent:${recentRoute.agent}:${recentRoute.intent}`;
  return recentRoute.intent || null;
}

function updateQuestionPatternRouteScores(existing = {}, entry = {}) {
  const questionPattern = entry && entry.questionPattern;
  const routeKey = entry && entry.routeUsed && entry.routeUsed.key;
  if (!questionPattern || !routeKey || routeKey === 'unknown') {
    return existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  }
  const source = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  const patternMemory = source[questionPattern] && typeof source[questionPattern] === 'object'
    ? source[questionPattern]
    : { routes: {}, examples: [] };
  const routes = patternMemory.routes && typeof patternMemory.routes === 'object' ? patternMemory.routes : {};
  const nextRoutes = {
    ...routes,
    [routeKey]: updateScore(routes[routeKey], entry)
  };
  const rankedRoutes = Object.entries(nextRoutes)
    .sort((a, b) => Number(b[1].score || 0) - Number(a[1].score || 0));
  return {
    ...source,
    [questionPattern]: {
      questionPattern,
      preferredRoute: rankedRoutes[0] ? rankedRoutes[0][0] : null,
      routes: nextRoutes,
      examples: [
        {
          timestamp: entry.timestamp,
          polarity: entry.polarity,
          feedback: entry.feedback,
          routeKey,
          reason: entry.successReason || entry.failureReason || null
        },
        ...(Array.isArray(patternMemory.examples) ? patternMemory.examples : [])
      ].slice(0, 6),
      lastUpdatedAt: new Date().toISOString()
    }
  };
}

function updateRouteScoresFromFeedback(existing = {}, entry = {}) {
  const routeKey = entry && entry.routeUsed && entry.routeUsed.key;
  if (!routeKey || routeKey === 'unknown') return existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  const current = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return {
    ...current,
    [routeKey]: updateScore(current[routeKey], entry)
  };
}

function updateReinforcementEventsFromFeedback(existing = [], routeScores = {}, entry = {}) {
  const routeKey = entry && entry.routeUsed && entry.routeUsed.key;
  if (!routeKey || routeKey === 'unknown') {
    return Array.isArray(existing) ? existing.slice(0, 80) : [];
  }
  const score = routeScores && routeScores[routeKey] ? routeScores[routeKey].score : 0;
  const reward = entry.polarity === 'positive' ? 2 : entry.polarity === 'negative' ? -2 : 0;
  if (!reward) return Array.isArray(existing) ? existing.slice(0, 80) : [];
  return [
    {
      timestamp: new Date().toISOString(),
      routeKey,
      routeCommand: entry.routeUsed.command || null,
      matchedRoute: entry.routeUsed.matchedRoute || null,
      reward,
      rewardLabel: `feedback_${entry.feedback || entry.polarity}`,
      founderMessage: preview(entry.sourceMessage),
      answerPattern: preview(entry.answerPattern),
      scoreAfter: score
    },
    ...(Array.isArray(existing) ? existing : [])
  ].slice(0, 80);
}

function updateScore(existing = null, entry = {}) {
  const current = existing && typeof existing === 'object'
    ? existing
    : { score: 0, positive: 0, negative: 0, neutral: 0, confidence: 0, examples: [] };
  const delta = entry.polarity === 'positive' ? 2 : entry.polarity === 'negative' ? -2 : 0;
  const positive = Number(current.positive || 0) + (entry.polarity === 'positive' ? 1 : 0);
  const negative = Number(current.negative || 0) + (entry.polarity === 'negative' ? 1 : 0);
  const neutral = Number(current.neutral || 0) + (entry.polarity === 'neutral' ? 1 : 0);
  const total = positive + negative + neutral;
  return {
    score: clamp(Number(current.score || 0) + delta, -10, 10),
    positive,
    negative,
    neutral,
    confidence: Number(Math.min(0.95, 0.35 + total * 0.08).toFixed(2)),
    lastFeedback: entry.feedback || null,
    lastUpdatedAt: new Date().toISOString(),
    examples: [
      {
        timestamp: entry.timestamp,
        polarity: entry.polarity,
        feedback: entry.feedback,
        founderMessage: preview(entry.sourceMessage),
        reason: entry.successReason || entry.failureReason || null
      },
      ...(Array.isArray(current.examples) ? current.examples : [])
    ].slice(0, 6)
  };
}

function buildSuccessReason(entry = {}) {
  const route = entry.routeUsed && entry.routeUsed.key ? entry.routeUsed.key : 'previous route';
  const style = labelsFromAnswerStyle(entry.answerStyle).join(', ') || 'answer style';
  return `founder approved ${route} with ${style} for this question pattern`;
}

function buildFailureReason(entry = {}, wrongAnswerAnalysis = null) {
  if (wrongAnswerAnalysis && wrongAnswerAnalysis.primaryFailureReason) {
    return wrongAnswerAnalysis.primaryFailureReason;
  }
  return `negative feedback: ${String(entry.feedback || 'founder rejected answer').replace(/_/g, ' ')}`;
}

function extractAnswerStyle(answer = '') {
  const text = String(answer || '').trim();
  const normalized = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const labels = [];
  const hasExecutionArtifacts = /\b(TASK_PLAN|APPROVE|Execution Plan|Files:|Validation:|Health:\s*\d+|Momentum|Team is ready|Current Foundation Health|Recommended Next Step)\b/i.test(text);

  if (/\b(you are|you may|you seem|the honest read|direct read|your behavior|your concern|you keep)\b/i.test(text)) {
    labels.push('direct_founder_reflection');
  }
  if (/\b(user|users|pain|value|useful|habit|care|proof|return|daily)\b/i.test(normalized)) {
    labels.push('user_value_grounded');
  }
  if (/\b(tradeoff|opportunity cost|strategic|assumption|risk|disagree|premortem|failure)\b/i.test(normalized)) {
    labels.push('strategic_tradeoff');
  }
  if (/\b(uncertain|unproven|evidence|missing|not proved|not proven)\b/i.test(normalized)) {
    labels.push('uncertainty_honest');
  }
  if (hasExecutionArtifacts) {
    labels.push('status_report');
  }
  if (/\b(Current Foundation Health|Highest Leverage Differentiator|Recommended Next Step|Phase 2 Opportunities)\b/i.test(text)) {
    labels.push('generic_template');
  }
  if (!labels.length) {
    labels.push(words <= 35 ? 'short_direct_answer' : 'unclassified_answer_style');
  }

  return {
    labels: unique(labels),
    length: words <= 45 ? 'concise' : words <= 110 ? 'moderate' : 'long',
    wordCount: words,
    hasExecutionArtifacts,
    hasFounderAddress: labels.includes('direct_founder_reflection'),
    hasUserValueGrounding: labels.includes('user_value_grounded'),
    hasStrategicTradeoff: labels.includes('strategic_tradeoff'),
    hasUncertainty: labels.includes('uncertainty_honest')
  };
}

function labelsFromAnswerStyle(style = {}) {
  return Array.isArray(style && style.labels) ? style.labels.filter(Boolean) : [];
}

function labelsFromFeedbackEntry(entry = {}) {
  const direct = labelsFromAnswerStyle(entry.answerStyle);
  if (direct.length) return direct;
  return labelsFromAnswerStyle(extractAnswerStyle(entry.answerPattern || entry.rawAnswerPreview || ''));
}

function feedbackRelevance(normalizedMessage, entry = {}) {
  const question = normalizePattern(entry.questionPattern || entry.rawQuestionPreview || '');
  const answer = normalizePattern(entry.answerPattern || entry.rawAnswerPreview || '');
  const best = Math.max(tokenOverlap(normalizedMessage, question), tokenOverlap(normalizedMessage, answer));
  const recencyBoost = isRecent(entry.timestamp) ? 0.04 : 0;
  return Math.min(1, best + recencyBoost);
}

function countFeedbackPolarities(items = []) {
  return items.reduce((counts, entry) => {
    const polarity = entry && entry.polarity ? entry.polarity : 'unknown';
    return {
      ...counts,
      [polarity]: (counts[polarity] || 0) + 1
    };
  }, { positive: 0, negative: 0, neutral: 0 });
}

function countBy(items = [], key = '') {
  return items.reduce((counts, entry) => {
    const value = entry && entry[key] ? entry[key] : 'unknown';
    return {
      ...counts,
      [value]: (counts[value] || 0) + 1
    };
  }, {});
}

function dedupeFeedback(items = []) {
  const seen = new Set();
  return items.filter((entry) => {
    if (!entry) return false;
    const key = [
      entry.feedback,
      entry.adaptation,
      entry.questionPattern,
      entry.answerPattern,
      entry.timestamp
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function styleRejectedBy(entry = {}) {
  switch (entry.adaptation || entry.feedback) {
    case 'stay_conversational':
    case 'too_much_cto_mode':
      return 'cto/report framing';
    case 'add_specific_product_test':
    case 'too_generic':
      return 'generic answer';
    case 'answer_actual_question_first':
    case 'not_relevant':
      return 'irrelevant answer';
    case 'state_uncertainty_and_risk':
    case 'too_optimistic':
      return 'overconfident answer';
    case 'ground_in_user_value':
    case 'too_philosophical':
      return 'abstract answer';
    case 'raise_to_strategy':
    case 'too_tactical':
      return 'overly tactical answer';
    default:
      return null;
  }
}

function stripRejectedTemplateLines(response = '', guidance = {}) {
  const shouldAvoidReportFraming = (guidance.rejectedStyles || []).includes('cto/report framing') ||
    (guidance.avoidedAnswerStyles || []).includes('status_report');
  const shouldAvoidGeneric = (guidance.rejectedStyles || []).includes('generic answer') ||
    (guidance.avoidedAnswerStyles || []).includes('generic_template');
  if (!shouldAvoidReportFraming && !shouldAvoidGeneric) return response;
  const blocked = [
    /^current foundation health:/i,
    /^phase 2 opportunities:/i,
    /^highest leverage differentiator:/i,
    /^trust risk:/i,
    /^recommended next step:/i,
    /^health:\s*\d+/i,
    /^momentum:/i,
    /^risk:/i,
    /^files:/i,
    /^validation:/i
  ];
  const kept = String(response || '')
    .split(/\r?\n/)
    .filter((line) => !blocked.some((pattern) => pattern.test(line.trim())));
  return kept.join('\n').trim();
}

function applyPreferredAnswerStyle(response = '', guidance = {}) {
  const preferred = guidance.preferredAnswerStyles || [];
  const avoided = guidance.avoidedAnswerStyles || [];
  let next = stripRejectedTemplateLines(response, {
    ...guidance,
    avoidedAnswerStyles: unique([...avoided, 'status_report', 'generic_template'])
  });
  if (preferred.includes('direct_founder_reflection') && !/\b(direct|you are|you may|you seem|the honest read)\b/i.test(next)) {
    next = `Direct read: ${next}`;
  }
  if (preferred.includes('user_value_grounded') && !/\b(user|proof|useful|value|habit|care)\b/i.test(next)) {
    next = `${next}\n\nUser-value check: this only matters if it proves repeated user pain or stronger product pull.`;
  }
  return next;
}

function tokenOverlap(left = '', right = '') {
  const leftTokens = importantTokens(left);
  const rightTokens = importantTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter((token) => rightSet.has(token)).length;
  return shared / Math.max(leftTokens.length, rightTokens.length);
}

function importantTokens(value = '') {
  return normalizePattern(value)
    .split(' ')
    .filter((token) => token.length > 3)
    .filter((token) => !STOP_WORDS.has(token));
}

function normalizePattern(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function preview(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240) || null;
}

function isRecent(timestamp) {
  const value = Date.parse(timestamp || '');
  if (!Number.isFinite(value)) return false;
  return Date.now() - value < 14 * 24 * 60 * 60 * 1000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function formatAdaptation(adaptation = '') {
  return String(adaptation || 'adjust future answers')
    .replace(/_/g, ' ');
}

function formatTasteProfile(model = {}) {
  const profile = model && model.profile ? model.profile : {};
  const confidence = Math.round((profile.confidence || 0) * 100);
  return [
    `depth=${profile.preferredDepthLevel || 'unknown'}`,
    `tone=${profile.preferredTone || 'unknown'}`,
    `strategy=${profile.preferredStrategicDensity || 'unknown'}`,
    `skepticism=${profile.preferredSkepticismLevel || 'unknown'}`,
    `confidence=${confidence}%`
  ].join(', ');
}

function formatFailureAnalysis(analysis = null) {
  if (!analysis) return 'Failure analyzed: not applicable for positive feedback.';
  return `Failure analyzed: ${analysis.failureReasons.map((item) => item.replace(/_/g, ' ')).join(', ')}.`;
}

function buildAdaptationLine(entry = {}) {
  switch (entry.adaptation) {
    case 'answer_actual_question_first':
    case 'reconstruct_before_answering':
      return 'I will keep this closer to the actual founder question: answer the concern first, then add context only if it helps.';
    case 'add_specific_product_test':
      return 'Concrete test: name the user pain, the repeated moment, and what would prove the answer useful in the product.';
    case 'raise_to_strategy':
      return 'Strategic check: this matters only if it changes user pull, trust, or the path toward the Explain wedge.';
    case 'state_uncertainty_and_risk':
      return 'Uncertainty: this remains unproven until real use shows repeat behavior, not just a convincing explanation.';
    case 'stay_conversational':
      return 'I will keep this conversational and avoid status or CTO-report framing unless you explicitly ask for it.';
    case 'ground_in_user_value':
      return 'Grounding: the answer should tie back to a concrete user outcome, not just the idea behind it.';
    case 'watch_for_followup':
      return 'I will treat this as mixed feedback and watch the next founder reaction before changing the style strongly.';
    default:
      return null;
  }
}

const STOP_WORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'about',
  'this',
  'that',
  'with',
  'from',
  'your',
  'youre',
  'founder',
  'answer',
  'question',
  'would',
  'should',
  'could',
  'have',
  'were',
  'been',
  'they',
  'them'
]);

module.exports = {
  classifyFounderFeedback,
  maybeRouteFounderFeedback,
  recordFounderFeedback,
  applyFounderFeedbackToResponse,
  buildFounderFeedbackGuidance,
  findRelevantFounderFeedback,
  normalizePattern,
  formatTasteProfile,
  formatFailureAnalysis
};
