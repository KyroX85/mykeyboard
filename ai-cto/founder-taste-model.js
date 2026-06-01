const MAX_TASTE_OBSERVATIONS = 60;

const DEFAULT_TASTE_MODEL = {
  version: '1.0',
  observations: [],
  likedPatterns: [],
  rejectedPatterns: [],
  profile: {
    preferredDepthLevel: 'unknown',
    preferredTone: 'unknown',
    preferredStrategicDensity: 'unknown',
    preferredSkepticismLevel: 'unknown',
    confidence: 0
  },
  lastUpdatedAt: null
};

function updateFounderTasteModel(existing = {}, feedbackEntry = {}) {
  const model = normalizeTasteModel(existing);
  const observation = buildTasteObservation(feedbackEntry);
  if (!observation) return model;

  const observations = [observation, ...model.observations].slice(0, MAX_TASTE_OBSERVATIONS);
  const likedPatterns = observation.polarity === 'positive'
    ? [observation, ...model.likedPatterns].slice(0, 20)
    : model.likedPatterns.slice(0, 20);
  const rejectedPatterns = observation.polarity === 'negative'
    ? [observation, ...model.rejectedPatterns].slice(0, 20)
    : model.rejectedPatterns.slice(0, 20);

  return {
    ...model,
    observations,
    likedPatterns,
    rejectedPatterns,
    profile: inferTasteProfile(likedPatterns, rejectedPatterns),
    lastUpdatedAt: new Date().toISOString()
  };
}

function applyFounderTasteToResponse(response = '', context = {}) {
  const model = normalizeTasteModel(context.memory && context.memory.founderTasteModel);
  if ((model.profile.confidence || 0) < 0.45) return response;

  const answerTaste = analyzeAnswerTaste(response);
  const guidance = buildTasteGuidance(model.profile, answerTaste);
  if (!guidance || String(response).includes(guidance)) return response;

  return [String(response || '').trim(), '', guidance].filter(Boolean).join('\n');
}

function buildTasteObservation(feedbackEntry = {}) {
  if (!feedbackEntry || !feedbackEntry.polarity) return null;
  const answerTaste = analyzeAnswerTaste(feedbackEntry.rawAnswerPreview || feedbackEntry.answerPattern || '');
  return {
    timestamp: feedbackEntry.timestamp || new Date().toISOString(),
    polarity: feedbackEntry.polarity,
    feedback: feedbackEntry.feedback || null,
    confidence: feedbackEntry.confidence || null,
    questionPattern: feedbackEntry.questionPattern || null,
    answerPattern: feedbackEntry.answerPattern || null,
    depthLevel: answerTaste.depthLevel,
    tone: answerTaste.tone,
    strategicDensity: answerTaste.strategicDensity,
    skepticismLevel: answerTaste.skepticismLevel
  };
}

function analyzeAnswerTaste(answer = '') {
  const text = String(answer || '');
  const clean = text.replace(/^Memory Sources Used:[^\n]*\n?/i, '')
    .replace(/^Route Confidence:[^\n]*\n?/im, '')
    .replace(/^Route Reason:[^\n]*\n?/im, '');
  const tokens = clean.toLowerCase().match(/[a-z0-9']+/g) || [];
  const wordCount = tokens.length;
  const lines = clean.split(/\r?\n/).filter((line) => line.trim()).length;
  const strategicHits = countMatches(clean, STRATEGIC_TERMS);
  const skepticalHits = countMatches(clean, SKEPTICISM_TERMS);
  const statusHits = countMatches(clean, STATUS_TERMS);
  const abstractHits = countMatches(clean, ABSTRACT_TERMS);

  return {
    depthLevel: wordCount >= 95 || lines >= 5 ? 'deep' : wordCount >= 45 ? 'medium' : 'short',
    tone: statusHits >= 2
      ? 'status'
      : abstractHits > strategicHits && abstractHits >= 2
        ? 'abstract'
        : /\b(bro|you may|honest|risk|useful|real)\b/i.test(clean)
          ? 'direct_conversational'
          : 'plain',
    strategicDensity: strategicHits >= 5 ? 'high' : strategicHits >= 2 ? 'medium' : 'low',
    skepticismLevel: skepticalHits >= 4 ? 'high' : skepticalHits >= 2 ? 'medium' : 'low',
    wordCount,
    lines
  };
}

function inferTasteProfile(liked = [], rejected = []) {
  const positive = liked.filter(Boolean);
  const negative = rejected.filter(Boolean);
  const confidence = Math.min(0.9, Math.max(0, (positive.length + negative.length) * 0.12));

  return {
    preferredDepthLevel: choosePreferred('depthLevel', positive, negative, 'medium'),
    preferredTone: choosePreferred('tone', positive, negative, 'direct_conversational'),
    preferredStrategicDensity: choosePreferred('strategicDensity', positive, negative, 'medium'),
    preferredSkepticismLevel: choosePreferred('skepticismLevel', positive, negative, 'medium'),
    confidence: Number(confidence.toFixed(2))
  };
}

function choosePreferred(key, positive = [], negative = [], fallback) {
  const scores = {};
  for (const item of positive) {
    scores[item[key]] = (scores[item[key]] || 0) + 2;
  }
  for (const item of negative) {
    scores[item[key]] = (scores[item[key]] || 0) - 1;
  }
  const ranked = Object.entries(scores)
    .filter(([value]) => value && value !== 'unknown')
    .sort((a, b) => b[1] - a[1]);
  return ranked.length ? ranked[0][0] : fallback;
}

function buildTasteGuidance(profile = {}, answerTaste = {}) {
  const guidance = [];
  if (profile.preferredTone === 'direct_conversational' && ['status', 'abstract'].includes(answerTaste.tone)) {
    guidance.push('keep it direct, not status-like');
  }
  if (profile.preferredStrategicDensity === 'high' && answerTaste.strategicDensity === 'low') {
    guidance.push('connect it to user leverage');
  }
  if (profile.preferredSkepticismLevel === 'high' && answerTaste.skepticismLevel === 'low') {
    guidance.push('include the hard risk or unproven assumption');
  }
  if (profile.preferredDepthLevel === 'deep' && answerTaste.depthLevel === 'short') {
    guidance.push('give the reasoning, not just the conclusion');
  }
  if (!guidance.length) return '';
  return `Founder taste calibration: ${guidance.join('; ')}.`;
}

function normalizeTasteModel(value = {}) {
  return {
    ...DEFAULT_TASTE_MODEL,
    ...(value && typeof value === 'object' ? value : {}),
    observations: Array.isArray(value && value.observations) ? value.observations : [],
    likedPatterns: Array.isArray(value && value.likedPatterns) ? value.likedPatterns : [],
    rejectedPatterns: Array.isArray(value && value.rejectedPatterns) ? value.rejectedPatterns : [],
    profile: {
      ...DEFAULT_TASTE_MODEL.profile,
      ...((value && value.profile) || {})
    }
  };
}

function countMatches(text = '', terms = []) {
  const lower = String(text || '').toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

const STRATEGIC_TERMS = [
  'user',
  'leverage',
  'trust',
  'retention',
  'dream',
  'wedge',
  'explain',
  'product',
  'useful',
  'behavior',
  'habit',
  'gboard'
];

const SKEPTICISM_TERMS = [
  'risk',
  'unproven',
  'might',
  'could',
  'if',
  'unless',
  'evidence',
  'fail',
  'not enough',
  'optional',
  'danger'
];

const STATUS_TERMS = [
  'health',
  'momentum',
  'status',
  'team ready',
  'task',
  'pipeline',
  'report'
];

const ABSTRACT_TERMS = [
  'vision',
  'philosophy',
  'organism',
  'identity',
  'sophistication',
  'architecture'
];

module.exports = {
  DEFAULT_TASTE_MODEL,
  analyzeAnswerTaste,
  updateFounderTasteModel,
  applyFounderTasteToResponse,
  inferTasteProfile,
  normalizeTasteModel
};
