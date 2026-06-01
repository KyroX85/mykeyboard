const MAX_META_ANALYSES = 30;

const KNOWN_LAYER_KEYS = [
  'founder_mind_reconstruction',
  'evidence_requirement_layer',
  'founder_mental_state_estimator',
  'truth_over_agreement_layer',
  'self_critique_layer',
  'route_evolution_layer',
  'generic_status_template',
  'stale_extra_layer'
];

function analyzeMetaLearning(memory = {}) {
  const layerScores = buildLayerScores(memory);
  const ranked = Object.values(layerScores).sort((a, b) => b.utilityScore - a.utilityScore);
  const highValueLayers = ranked.filter((layer) => layer.utilityScore >= 3 && layer.positiveEvidence.length > 0);
  const lowValueLayers = ranked
    .filter((layer) => layer.utilityScore <= -2 || layer.totalEvidence === 0)
    .sort((a, b) => a.utilityScore - b.utilityScore);
  const unnoticedLayers = ranked.filter((layer) => layer.totalEvidence === 0);
  const outcomeChanges = buildOutcomeChanges(layerScores, memory);
  const removalSafety = buildRemovalSafety(lowValueLayers);
  const recommendations = buildRecommendations({ highValueLayers, lowValueLayers, unnoticedLayers, outcomeChanges });

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    layerScores,
    highValueLayers,
    lowValueLayers,
    unnoticedLayers,
    outcomeChanges,
    recommendations,
    removalSafety,
    confidence: confidenceFor(layerScores, memory)
  };
}

function updateMetaLearningMemory(existing = {}, analysis = null) {
  const memory = normalizeMetaLearningMemory(existing);
  if (!analysis) return memory;
  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastAnalysis: analysis,
    analysisHistory: [analysis, ...memory.analysisHistory].slice(0, MAX_META_ANALYSES)
  };
}

function normalizeMetaLearningMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastAnalysis: source.lastAnalysis || null,
    analysisHistory: Array.isArray(source.analysisHistory)
      ? source.analysisHistory.filter(Boolean).slice(0, MAX_META_ANALYSES)
      : []
  };
}

function buildLayerScores(memory = {}) {
  const scores = {};
  for (const key of KNOWN_LAYER_KEYS) {
    scores[key] = blankLayerScore(key);
  }

  applyRouteScores(scores, memory.routeScores);
  applyFeedbackEvidence(scores, memory.founderFeedback);
  applyWrongAnswerEvidence(scores, memory.wrongAnswerAnalysis);
  applyEvidenceRequirement(scores, memory.evidenceRequirementMemory);
  applyRouteEvolution(scores, memory.routeEvolutionMemory);

  for (const score of Object.values(scores)) {
    score.totalEvidence = score.positiveEvidence.length + score.negativeEvidence.length;
    score.utilityScore = score.positiveEvidence.length * 2 - score.negativeEvidence.length * 2 + score.routeScore;
    score.classification = classifyLayer(score);
  }

  return scores;
}

function blankLayerScore(layerKey) {
  return {
    layerKey,
    routeScore: 0,
    positiveEvidence: [],
    negativeEvidence: [],
    totalEvidence: 0,
    utilityScore: 0,
    classification: 'OBSERVE'
  };
}

function applyRouteScores(scores, routeScores = {}) {
  for (const [routeKey, score] of Object.entries(normalizeObject(routeScores))) {
    const layerKey = normalizeLayerKey(routeKey);
    ensureScore(scores, layerKey);
    const routeScore = Number(score && score.score || 0);
    scores[layerKey].routeScore += routeScore;
    const positive = Number(score && score.positive || 0);
    const negative = Number(score && score.negative || 0);
    if (positive > 0) scores[layerKey].positiveEvidence.push(`route reward positive=${positive}`);
    if (negative > 0) scores[layerKey].negativeEvidence.push(`route reward negative=${negative}`);
  }
}

function applyFeedbackEvidence(scores, feedback = []) {
  for (const item of array(feedback)) {
    const key = inferLayerFromText(`${item.answerPattern || ''} ${item.adaptation || ''} ${item.feedback || ''}`);
    ensureScore(scores, key);
    if (item.polarity === 'positive') {
      scores[key].positiveEvidence.push(`founder feedback: ${item.feedback || 'positive'}`);
    } else if (item.polarity === 'negative') {
      scores[key].negativeEvidence.push(`founder feedback: ${item.feedback || 'negative'}`);
    }
  }
}

function applyWrongAnswerEvidence(scores, wrongAnswerAnalysis = {}) {
  const source = wrongAnswerAnalysis && typeof wrongAnswerAnalysis === 'object' ? wrongAnswerAnalysis : {};
  for (const item of array(source.recentFailures)) {
    const key = inferLayerFromText(`${item.answerPattern || ''} ${item.primaryFailureReason || ''}`);
    ensureScore(scores, key);
    scores[key].negativeEvidence.push(`wrong answer: ${item.primaryFailureReason || 'unknown'}`);
  }
}

function applyEvidenceRequirement(scores, evidenceRequirementMemory = {}) {
  for (const item of array(evidenceRequirementMemory.recentChecks)) {
    const key = inferLayerFromText(item.claimPreview || '');
    ensureScore(scores, key);
    if (item.status === 'EVIDENCE_SUPPORTED') {
      scores[key].positiveEvidence.push('evidence requirement supported claim');
    } else if (item.status === 'DOWNGRADE_REQUIRED') {
      scores[key].negativeEvidence.push('evidence requirement downgraded claim');
    }
  }
}

function applyRouteEvolution(scores, routeEvolutionMemory = {}) {
  const source = routeEvolutionMemory && typeof routeEvolutionMemory === 'object' ? routeEvolutionMemory : {};
  const analysis = source.lastAnalysis || {};
  for (const route of array(analysis.strongRoutes)) {
    const key = normalizeLayerKey(route.routeKey);
    ensureScore(scores, key);
    scores[key].positiveEvidence.push(`route evolution strong accuracy=${route.accuracy}`);
  }
  for (const route of array(analysis.weakRoutes)) {
    const key = normalizeLayerKey(route.routeKey);
    ensureScore(scores, key);
    scores[key].negativeEvidence.push(`route evolution weak accuracy=${route.accuracy}`);
  }
}

function buildOutcomeChanges(layerScores = {}, memory = {}) {
  return Object.values(layerScores)
    .filter((layer) => layer.totalEvidence > 0)
    .map((layer) => ({
      layerKey: layer.layerKey,
      direction: layer.utilityScore > 0 ? 'IMPROVED' : layer.utilityScore < 0 ? 'HURT_OR_NOISE' : 'UNCLEAR',
      evidence: [
        ...layer.positiveEvidence.slice(0, 3),
        ...layer.negativeEvidence.slice(0, 3)
      ],
      confidence: clamp(55 + layer.totalEvidence * 5, 55, 88)
    }));
}

function buildRemovalSafety(lowValueLayers = []) {
  return lowValueLayers.map((layer) => ({
    layerKey: layer.layerKey,
    requiresFounderApproval: true,
    safeAction: layer.totalEvidence === 0 ? 'OBSERVE_BEFORE_REMOVAL' : 'MARK_AS_REMOVE_CANDIDATE',
    rollbackStrategy: 'Do not delete automatically; disable behind a flag or remove only after founder approval and regression tests.',
    reason: layer.totalEvidence === 0
      ? 'Founder has not visibly benefited from this layer yet.'
      : 'Evidence suggests this layer hurts or fails to change answer quality.'
  }));
}

function buildRecommendations({ highValueLayers = [], lowValueLayers = [], unnoticedLayers = [], outcomeChanges = [] } = {}) {
  const recommendations = [];
  for (const layer of highValueLayers.slice(0, 3)) {
    recommendations.push({
      action: 'STRENGTHEN',
      layerKey: layer.layerKey,
      reason: `${layer.layerKey} has positive outcome evidence and should influence routing more often.`,
      confidence: clamp(62 + layer.positiveEvidence.length * 5, 62, 88)
    });
  }
  for (const layer of lowValueLayers.slice(0, 3)) {
    recommendations.push({
      action: layer.totalEvidence === 0 ? 'OBSERVE' : 'REMOVE_CANDIDATE',
      layerKey: layer.layerKey,
      reason: layer.totalEvidence === 0
        ? `${layer.layerKey} has no founder-visible outcome evidence yet.`
        : `${layer.layerKey} has weak or negative answer-quality evidence.`,
      confidence: clamp(55 + Math.abs(layer.utilityScore) * 4, 55, 86)
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      action: 'KEEP_COLLECTING_EVIDENCE',
      layerKey: 'all_layers',
      reason: 'Not enough outcome evidence exists to strengthen or retire layers safely.',
      confidence: 60
    });
  }
  return recommendations;
}

function classifyLayer(score = {}) {
  if (score.totalEvidence === 0) return 'UNNOTICED';
  if (score.utilityScore >= 3) return 'HIGH_VALUE';
  if (score.utilityScore <= -2) return 'LOW_VALUE';
  return 'UNCLEAR';
}

function inferLayerFromText(text = '') {
  const value = String(text || '').toLowerCase();
  if (/founder mind|mind reconstruction|actual question|concern first|direct reasoning/.test(value)) {
    return 'founder_mind_reconstruction';
  }
  if (/evidence requirement|evidence supported|downgraded claim/.test(value)) {
    return 'evidence_requirement_layer';
  }
  if (/mental state|reflection|doubt|frustration/.test(value)) {
    return 'founder_mental_state_estimator';
  }
  if (/truth over agreement|disagree|agreement/.test(value)) {
    return 'truth_over_agreement_layer';
  }
  if (/generic status|health momentum|status template|cto mode|team ready/.test(value)) {
    return 'generic_status_template';
  }
  return 'stale_extra_layer';
}

function normalizeLayerKey(routeKey = '') {
  const key = String(routeKey || '').toLowerCase();
  if (key.includes('founder_mind_reconstruction')) return 'founder_mind_reconstruction';
  if (key.includes('evidence_requirement')) return 'evidence_requirement_layer';
  if (key.includes('mental_state')) return 'founder_mental_state_estimator';
  if (key.includes('truth_over_agreement')) return 'truth_over_agreement_layer';
  if (key.includes('self_critique')) return 'self_critique_layer';
  if (key.includes('route_evolution')) return 'route_evolution_layer';
  if (key.includes('status') || key.includes('template')) return 'generic_status_template';
  return key.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown_layer';
}

function confidenceFor(layerScores = {}, memory = {}) {
  const totalEvidence = Object.values(layerScores).reduce((total, layer) => total + layer.totalEvidence, 0);
  const hasFeedback = array(memory.founderFeedback).length > 0;
  const hasRouteScores = Object.keys(normalizeObject(memory.routeScores)).length > 0;
  const base = hasFeedback && hasRouteScores ? 62 : 48;
  return clamp(base + totalEvidence * 2, 45, 88);
}

function ensureScore(scores, key) {
  if (!scores[key]) scores[key] = blankLayerScore(key);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

module.exports = {
  analyzeMetaLearning,
  updateMetaLearningMemory,
  normalizeMetaLearningMemory
};
