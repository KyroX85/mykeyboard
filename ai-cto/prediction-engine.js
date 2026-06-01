const MAX_PENDING = 40;
const MAX_COMPARISONS = 40;

function shouldPredictActionOutcome(action = '', context = {}) {
  const text = actionText(action, context).toLowerCase();
  if (!text.trim()) return false;
  if (/\b(hi|hello|thanks|ok bro|how are you|memory audit|status only)\b/.test(text)) return false;
  return /\b(action|decision|build|create|add|ship|implement|design|rewrite|feature|proposal|should we|what if|phase 2|explain|execution layer|screenshot|prediction|swipe|architecture|infrastructure|orchestration|governance|framework)\b/.test(text);
}

function generateActionPrediction(action = '', context = {}) {
  const text = actionText(action, context).trim();
  const signals = extractSignals(text);
  const actionClass = classifyAction(signals);
  const predictionId = buildPredictionId(text, actionClass);

  return {
    version: '1.0',
    predictionId,
    timestamp: new Date().toISOString(),
    action: text.slice(0, 260),
    actionClass,
    founderReaction: founderReactionFor(actionClass),
    userReaction: userReactionFor(actionClass),
    marketReaction: marketReactionFor(actionClass),
    realitySignalsToWatch: realitySignalsFor(actionClass),
    confidence: confidenceFor(signals, actionClass)
  };
}

function comparePredictionWithReality(prediction = {}, reality = {}) {
  const founderReality = String(reality.founderReaction || '');
  const userReality = String(reality.userReaction || '');
  const marketReality = String(reality.marketReaction || '');
  const matches = [];
  const misses = [];
  const unknowns = [];

  classifyReality('founder', founderReality, prediction.founderReaction, matches, misses, unknowns);
  classifyReality('user', userReality, prediction.userReaction, matches, misses, unknowns);
  classifyReality('market', marketReality, prediction.marketReaction, matches, misses, unknowns);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    predictionId: prediction.predictionId || null,
    actionClass: prediction.actionClass || 'UNKNOWN',
    matches,
    misses,
    unknowns,
    reality: {
      founderReaction: founderReality || null,
      userReaction: userReality || null,
      marketReaction: marketReality || null
    },
    calibration: calibrationFor(matches, misses, unknowns)
  };
}

function updatePredictionMemory(existing = {}, prediction = null, comparison = null) {
  const model = normalizePredictionMemory(existing);
  let pendingPredictions = model.pendingPredictions;
  let completedComparisons = model.completedComparisons;
  let lastPrediction = model.lastPrediction;
  let lastComparison = model.lastComparison;

  if (prediction) {
    pendingPredictions = [
      prediction,
      ...pendingPredictions.filter((item) => item.predictionId !== prediction.predictionId)
    ].slice(0, MAX_PENDING);
    lastPrediction = prediction;
  }

  if (comparison) {
    completedComparisons = [
      comparison,
      ...completedComparisons.filter((item) => item.predictionId !== comparison.predictionId)
    ].slice(0, MAX_COMPARISONS);
    pendingPredictions = pendingPredictions.filter((item) => item.predictionId !== comparison.predictionId);
    lastComparison = comparison;
  }

  return {
    version: '1.0',
    pendingPredictions,
    completedComparisons,
    classCounts: countByClass(pendingPredictions),
    calibrationCounts: countCalibration(completedComparisons),
    lastPrediction,
    lastComparison,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizePredictionMemory(value = {}) {
  const pendingPredictions = Array.isArray(value && value.pendingPredictions) ? value.pendingPredictions : [];
  const completedComparisons = Array.isArray(value && value.completedComparisons) ? value.completedComparisons : [];
  return {
    version: '1.0',
    pendingPredictions,
    completedComparisons,
    classCounts: value && value.classCounts && typeof value.classCounts === 'object'
      ? value.classCounts
      : countByClass(pendingPredictions),
    calibrationCounts: value && value.calibrationCounts && typeof value.calibrationCounts === 'object'
      ? value.calibrationCounts
      : countCalibration(completedComparisons),
    lastPrediction: value && value.lastPrediction ? value.lastPrediction : null,
    lastComparison: value && value.lastComparison ? value.lastComparison : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function actionText(action, context = {}) {
  return String(
    action ||
    context.action ||
    context.decision ||
    context.initiative ||
    context.idea ||
    context.proposal ||
    context.founderMessage ||
    context.agentAnswer ||
    ''
  );
}

function extractSignals(text = '') {
  const lower = text.toLowerCase();
  return {
    explain: /\b(explain|understand|screenshot|bill|notice|form|document|error|message)\b/.test(lower),
    executionLayer: /\b(execution layer|glass handle|liquid glass|action surface|draft|reply|email|prepare message)\b/.test(lower),
    infrastructure: /\b(infrastructure|architecture|framework|orchestration|governance|report|memory layer|agent system|multi-agent|scalable|modern)\b/.test(lower),
    hotPath: /\b(rewrite|prediction|keyboardservice|hot path|autocorrect|swipe|typing|latency)\b/.test(lower),
    explicitAction: /\b(action|decision|build|create|ship|implement|design|rewrite|proposal|should we|what if)\b/.test(lower)
  };
}

function classifyAction(signals) {
  if (signals.hotPath) return 'HOT_PATH_KEYBOARD';
  if (signals.infrastructure) return 'INFRASTRUCTURE_HEAVY';
  if (signals.explain || signals.executionLayer) return 'PHASE2_EXPLAIN';
  return 'GENERAL_ACTION';
}

function founderReactionFor(actionClass) {
  if (actionClass === 'PHASE2_EXPLAIN') {
    return {
      prediction: 'Founder will likely be interested but will ask for evidence that Explain becomes a real habit, not just a cool demo.',
      confidence: 74
    };
  }
  if (actionClass === 'INFRASTRUCTURE_HEAVY') {
    return {
      prediction: 'Founder will likely become impatient, unsatisfied, or skeptical because the work may feel impressive but not useful.',
      confidence: 82
    };
  }
  if (actionClass === 'HOT_PATH_KEYBOARD') {
    return {
      prediction: 'Founder will likely be cautious or worried and ask for evidence because the protected typing foundation could regress.',
      confidence: 80
    };
  }
  return {
    prediction: 'Founder reaction is uncertain until the action is tied to the current dream, user leverage, and evidence.',
    confidence: 58
  };
}

function userReactionFor(actionClass) {
  if (actionClass === 'PHASE2_EXPLAIN') {
    return {
      prediction: 'Users may care if the explanation happens at a real confusing moment and is faster than leaving the app.',
      confidence: 66
    };
  }
  if (actionClass === 'INFRASTRUCTURE_HEAVY') {
    return {
      prediction: 'Users will probably not notice or not care because internal orchestration is invisible unless it creates product value.',
      confidence: 78
    };
  }
  if (actionClass === 'HOT_PATH_KEYBOARD') {
    return {
      prediction: 'Users will react through typing trust: latency, correction behavior, and predictability matter more than claims of smarter prediction.',
      confidence: 82
    };
  }
  return {
    prediction: 'User reaction is unknown until the action creates a visible reduction in friction.',
    confidence: 56
  };
}

function marketReactionFor(actionClass) {
  if (actionClass === 'PHASE2_EXPLAIN') {
    return {
      prediction: 'Market reaction could be positive if Explain clearly differentiates Aritenis from mature keyboards.',
      confidence: 62
    };
  }
  if (actionClass === 'INFRASTRUCTURE_HEAVY') {
    return {
      prediction: 'Market reaction will likely be weak because there is no clear differentiation users can feel.',
      confidence: 76
    };
  }
  if (actionClass === 'HOT_PATH_KEYBOARD') {
    return {
      prediction: 'Market reaction will be neutral unless the improvement is visibly better than mature keyboards without hurting trust.',
      confidence: 70
    };
  }
  return {
    prediction: 'Market reaction is unknown without a visible user outcome or category wedge.',
    confidence: 55
  };
}

function realitySignalsFor(actionClass) {
  if (actionClass === 'PHASE2_EXPLAIN') {
    return [
      'Repeat Explain usage across multiple sessions.',
      'Founder asks to deepen the wedge instead of replacing it.',
      'Users choose Explain instead of leaving the app for another AI tool.',
      'Retention or activation improves without hurting typing trust.'
    ];
  }
  if (actionClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'Founder says the work feels useful rather than impressive.',
      'A user-visible product moment improves because of the infrastructure.',
      'No increase in vague status reports or architecture theatre.'
    ];
  }
  if (actionClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Typing latency and correction behavior do not regress.',
      'Swipe or prediction confidence improves in real use.',
      'Rollback remains simple if trust drops.'
    ];
  }
  return [
    'Founder reaction after seeing the result.',
    'User-visible friction reduction.',
    'Evidence of repeat use or trust improvement.'
  ];
}

function classifyReality(label, text, prediction, matches, misses, unknowns) {
  if (!text || /\b(no data|unknown|not yet|no .*yet)\b/i.test(text)) {
    unknowns.push(`${label} reaction still unknown.`);
    return;
  }
  const predictionText = String(prediction && prediction.prediction || '').toLowerCase();
  const realityText = text.toLowerCase();
  const shared = ['evidence', 'liked', 'interested', 'skeptical', 'impatient', 'not care', 'not notice', 'trust', 'latency', 'weak', 'positive']
    .some((term) => predictionText.includes(term) && realityText.includes(term));
  if (shared) {
    matches.push(`${label} reaction matched the prediction direction.`);
  } else {
    misses.push(`${label} reaction differed from the prediction direction.`);
  }
}

function calibrationFor(matches, misses, unknowns) {
  if (misses.length > 0) return 'NEEDS_RECALIBRATION';
  if (unknowns.length > matches.length) return 'INSUFFICIENT_REALITY';
  return 'PREDICTION_SUPPORTED';
}

function confidenceFor(signals, actionClass) {
  const signalCount = ['explain', 'executionLayer', 'infrastructure', 'hotPath', 'explicitAction']
    .filter((key) => signals[key]).length;
  const base = actionClass === 'GENERAL_ACTION' ? 54 : 64;
  return clamp(base + signalCount * 5, 50, 88);
}

function countByClass(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.actionClass ? item.actionClass : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function countCalibration(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.calibration ? item.calibration : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function buildPredictionId(action, actionClass) {
  const normalized = String(action || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${actionClass}:${normalized || 'action'}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldPredictActionOutcome,
  generateActionPrediction,
  comparePredictionWithReality,
  updatePredictionMemory,
  normalizePredictionMemory
};
