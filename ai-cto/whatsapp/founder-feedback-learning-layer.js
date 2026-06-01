const {
  readMemory,
  writeMemory,
  readConversationMemory
} = require('./memory-store');
const {
  updateFounderTasteModel
} = require('../founder-taste-model');

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
      skipExecutionSchema: true
    },
    response: [
      'Feedback recorded.',
      `Learned: ${formatAdaptation(entry.adaptation)}.`,
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
  const current = readMemory();
  const entry = {
    timestamp: new Date().toISOString(),
    feedback: classification.feedback,
    polarity: classification.polarity,
    confidence: classification.confidence,
    adaptation: classification.adaptation,
    sourceMessage: classification.sourceMessage,
    questionPattern: normalizePattern(previous.question),
    answerPattern: normalizePattern(previous.answer),
    rawQuestionPreview: preview(previous.question),
    rawAnswerPreview: preview(previous.answer)
  };

  const existing = Array.isArray(current.founderFeedback) ? current.founderFeedback : [];
  const nextFeedback = [entry, ...existing].slice(0, MAX_FEEDBACK_ITEMS);
  const founderTasteModel = updateFounderTasteModel(current.founderTasteModel, entry);
  writeMemory({
    ...current,
    founderFeedback: nextFeedback,
    lastFeedback: entry,
    founderTasteModel
  });
  return entry;
}

function applyFounderFeedbackToResponse(response = '', context = {}) {
  const relevant = findRelevantFounderFeedback(context.message, context.memory);
  if (!relevant.length) return response;

  const strongest = relevant[0];
  if (strongest.polarity === 'positive') {
    return response;
  }

  const adaptationLine = buildAdaptationLine(strongest);
  if (!adaptationLine || String(response).includes(adaptationLine)) {
    return response;
  }

  return [String(response || '').trim(), '', adaptationLine].filter(Boolean).join('\n');
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

function feedbackRelevance(normalizedMessage, entry = {}) {
  const question = normalizePattern(entry.questionPattern || entry.rawQuestionPreview || '');
  const answer = normalizePattern(entry.answerPattern || entry.rawAnswerPreview || '');
  const best = Math.max(tokenOverlap(normalizedMessage, question), tokenOverlap(normalizedMessage, answer));
  const recencyBoost = isRecent(entry.timestamp) ? 0.04 : 0;
  return Math.min(1, best + recencyBoost);
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
  findRelevantFounderFeedback,
  normalizePattern,
  formatTasteProfile
};
