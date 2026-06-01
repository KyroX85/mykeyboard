const MAX_RECENT_QUESTIONS = 40;
const MAX_LEARNED_CLUSTERS = 20;

const STATIC_CLUSTERS = [
  {
    clusterId: 'DREAM_QUESTIONS',
    family: 'dream questions',
    category: 'VISION',
    patterns: [
      /\bdream\b/i,
      /\bvision\b/i,
      /\bmoving\s+(toward|towards)\b/i,
      /\bsucceeds?\s+beyond\b/i,
      /\bwhat\s+does\s+(the\s+)?world\s+look\s+like\b/i
    ],
    description: 'Questions testing whether the work still points toward the founder dream.'
  },
  {
    clusterId: 'STRATEGY_QUESTIONS',
    family: 'strategy questions',
    category: 'FOUNDER_STRATEGY',
    patterns: [
      /\bfocus\s+only\b/i,
      /\bwrong\s+thing\b/i,
      /\bwrong\s+direction\b/i,
      /\bwhat\s+happens\s+if\b/i,
      /\bdisagree\s+with\s+me\b/i
    ],
    description: 'Questions testing opportunity cost, direction, and strategic tradeoffs.'
  },
  {
    clusterId: 'DOUBT_QUESTIONS',
    family: 'doubt questions',
    category: 'DOUBT',
    patterns: [
      /\bsomething\s+feels\s+off\b/i,
      /\bnot\s+satisfied\b/i,
      /\bscared\b/i,
      /\bworried\b/i,
      /\bimpressive\s+instead\s+of\s+useful\b/i
    ],
    description: 'Questions expressing unease, hidden concern, or product dissatisfaction.'
  },
  {
    clusterId: 'PREMORTEM_QUESTIONS',
    family: 'premortem questions',
    category: 'FOUNDER_STRATEGY',
    patterns: [
      /\bif\s+we\s+fail\b/i,
      /\bfail\s+in\s+\d+\s+(years?|months?)\b/i,
      /\bwhy\s+(would|do)\s+we\s+fail\b/i,
      /\bfailure\s+mode\b/i
    ],
    description: 'Questions asking for failure causes before they happen.'
  },
  {
    clusterId: 'REFLECTION_QUESTIONS',
    family: 'reflection questions',
    category: 'REFLECTION',
    patterns: [
      /\bbased\s+on\s+my\s+behavior\b/i,
      /\bwhat\s+am\s+i\s+optimizing\s+for\b/i,
      /\bwhy\s+am\s+i\s+asking\b/i,
      /\bchanged\s+my\s+mind\b/i,
      /\bsame\s+founder\b/i
    ],
    description: 'Questions asking the agent to reconstruct founder motives or founder evolution.'
  },
  {
    clusterId: 'USER_VALUE_QUESTIONS',
    family: 'user value questions',
    category: 'DOUBT',
    patterns: [
      /\busers?\s+(actually\s+)?care\b/i,
      /\busers?\s+(want|need)\b/i,
      /\bwho\s+would\s+use\b/i,
      /\bwhy\s+would\s+users?\b/i,
      /\buseful\b/i
    ],
    description: 'Questions testing whether users would actually care about the product direction.'
  }
];

function classifyFounderQuestionCluster(message = '', context = {}) {
  const text = normalize(message);
  if (!text) return null;

  const staticMatch = bestStaticCluster(text);
  if (staticMatch) return staticMatch;

  const learnedMatch = bestLearnedCluster(text, context.founderQuestionClusters);
  if (learnedMatch) return learnedMatch;

  return fallbackClusterFromContext(text, context);
}

function updateFounderQuestionClusters(existing = {}, event = {}) {
  const model = normalizeQuestionClusters(existing);
  const classification = event.questionCluster ||
    classifyFounderQuestionCluster(event.message, {
      ...event,
      founderQuestionClusters: model
    });
  if (!classification) return model;

  const clusters = {
    ...model.clusters,
    [classification.clusterId]: updateClusterStats(model.clusters[classification.clusterId], classification, event)
  };
  const learnedClusters = updateLearnedClusters(model.learnedClusters, classification, event);
  const recentQuestions = [{
    timestamp: new Date().toISOString(),
    messagePattern: normalize(event.message).slice(0, 160),
    clusterId: classification.clusterId,
    family: classification.family,
    category: event.category || classification.category || null,
    intent: event.intent || null,
    confidence: Math.min(90, event.confidence || classification.confidence || 50)
  }, ...model.recentQuestions].slice(0, MAX_RECENT_QUESTIONS);

  return {
    ...model,
    clusters,
    learnedClusters,
    recentQuestions,
    lastCluster: recentQuestions[0],
    lastUpdatedAt: new Date().toISOString()
  };
}

function bestStaticCluster(text = '') {
  const ranked = STATIC_CLUSTERS.map((cluster) => {
    const hits = cluster.patterns.filter((pattern) => pattern.test(text)).length;
    return {
      clusterId: cluster.clusterId,
      family: cluster.family,
      category: cluster.category,
      description: cluster.description,
      confidence: Math.min(90, 58 + hits * 14),
      matchCount: hits,
      source: 'static'
    };
  })
    .filter((item) => item.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || b.confidence - a.confidence);
  return ranked[0] || null;
}

function bestLearnedCluster(text = '', existing = {}) {
  const model = normalizeQuestionClusters(existing);
  const tokens = importantTokens(text);
  if (!tokens.length) return null;

  const ranked = model.learnedClusters.map((cluster) => {
    const overlap = tokenOverlap(tokens, cluster.tokens || []);
    return {
      clusterId: cluster.clusterId,
      family: cluster.family,
      category: cluster.category,
      description: cluster.description,
      confidence: Math.min(86, 50 + Math.round(overlap * 45)),
      source: 'learned',
      overlap
    };
  })
    .filter((item) => item.overlap >= 0.34)
    .sort((a, b) => b.overlap - a.overlap || b.confidence - a.confidence);
  return ranked[0] || null;
}

function fallbackClusterFromContext(text = '', context = {}) {
  const category = String(context.category || '').trim();
  const intent = String(context.intent || '').trim();
  if (!category && !intent) return null;
  const family = `${readable(category || intent)} questions`;
  return {
    clusterId: learnedClusterId(category || intent, text),
    family,
    category: category || null,
    description: `Learned question family for ${readable(category || intent)}.`,
    confidence: Math.min(72, Math.max(45, context.confidence || 55)),
    source: 'fallback'
  };
}

function updateClusterStats(existing = {}, classification = {}, event = {}) {
  return {
    clusterId: classification.clusterId,
    family: classification.family,
    category: classification.category || event.category || existing.category || null,
    description: classification.description || existing.description || null,
    count: (existing.count || 0) + 1,
    lastIntent: event.intent || existing.lastIntent || null,
    lastQuestionPattern: normalize(event.message).slice(0, 160),
    lastSeenAt: new Date().toISOString(),
    source: classification.source || existing.source || 'static'
  };
}

function updateLearnedClusters(items = [], classification = {}, event = {}) {
  const list = Array.isArray(items) ? items : [];
  const shouldLearn = classification.source === 'fallback' || String(classification.clusterId || '').startsWith('LEARNED_');
  if (!shouldLearn) return list.slice(0, MAX_LEARNED_CLUSTERS);

  const tokens = importantTokens(event.message);
  const existing = list.find((cluster) => cluster.clusterId === classification.clusterId);
  const next = existing
    ? {
        ...existing,
        tokens: mergeTokens(existing.tokens, tokens),
        count: (existing.count || 0) + 1,
        lastQuestionPattern: normalize(event.message).slice(0, 160),
        lastSeenAt: new Date().toISOString()
      }
    : {
        clusterId: classification.clusterId,
        family: classification.family,
        category: classification.category || event.category || null,
        description: classification.description,
        tokens,
        count: 1,
        lastQuestionPattern: normalize(event.message).slice(0, 160),
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };

  return [next, ...list.filter((cluster) => cluster.clusterId !== next.clusterId)]
    .slice(0, MAX_LEARNED_CLUSTERS);
}

function normalizeQuestionClusters(value = {}) {
  return {
    version: '1.0',
    clusters: value && typeof value.clusters === 'object' && value.clusters ? value.clusters : {},
    learnedClusters: Array.isArray(value && value.learnedClusters) ? value.learnedClusters : [],
    recentQuestions: Array.isArray(value && value.recentQuestions) ? value.recentQuestions : [],
    lastCluster: value && value.lastCluster ? value.lastCluster : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function learnedClusterId(category = '', text = '') {
  const label = String(category || 'UNKNOWN')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'UNKNOWN';
  const tokens = importantTokens(text).slice(0, 3).join('_').toUpperCase() || 'QUESTION';
  return `LEARNED_${label}_${tokens}`;
}

function tokenOverlap(leftTokens = [], rightTokens = []) {
  const right = new Set(rightTokens);
  const shared = leftTokens.filter((token) => right.has(token)).length;
  return shared / Math.max(leftTokens.length, rightTokens.length, 1);
}

function mergeTokens(left = [], right = []) {
  return [...new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])])].slice(0, 24);
}

function importantTokens(value = '') {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 3)
    .filter((token) => !STOP_WORDS.has(token));
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readable(value = '') {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'unknown';
}

const STOP_WORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'that',
  'this',
  'with',
  'from',
  'about',
  'think',
  'really',
  'actually',
  'founder',
  'question',
  'should',
  'would',
  'could'
]);

module.exports = {
  classifyFounderQuestionCluster,
  updateFounderQuestionClusters,
  normalizeQuestionClusters,
  STATIC_CLUSTERS
};
