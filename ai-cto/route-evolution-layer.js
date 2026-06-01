const MAX_ANALYSES = 30;

function analyzeRouteEvolution(memory = {}) {
  const routeAccuracy = buildRouteAccuracy(memory.routeScores);
  const weakRoutes = Object.values(routeAccuracy)
    .filter((route) => route.sampleCount >= 3 && route.accuracy <= 0.45)
    .sort((a, b) => a.accuracy - b.accuracy);
  const strongRoutes = Object.values(routeAccuracy)
    .filter((route) => route.sampleCount >= 3 && route.accuracy >= 0.75)
    .sort((a, b) => b.accuracy - a.accuracy);
  const overloadedRoutes = detectOverloadedRoutes(memory, strongRoutes);
  const mergeSuggestions = suggestMerges(weakRoutes, strongRoutes);
  const splitSuggestions = suggestSplits(overloadedRoutes, memory);
  const newRouteSuggestions = suggestNewRoutes(memory.founderQuestionClusters);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    routeAccuracy,
    weakRoutes,
    strongRoutes,
    mergeSuggestions,
    splitSuggestions,
    newRouteSuggestions,
    recommendations: buildRecommendations({
      weakRoutes,
      mergeSuggestions,
      splitSuggestions,
      newRouteSuggestions
    })
  };
}

function updateRouteEvolutionMemory(existing = {}, analysis = null) {
  const model = normalizeRouteEvolutionMemory(existing);
  if (!analysis) return model;
  const analysisHistory = [
    analysis,
    ...model.analysisHistory
  ].slice(0, MAX_ANALYSES);
  return {
    version: '1.0',
    analysisHistory,
    lastAnalysis: analysis,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeRouteEvolutionMemory(value = {}) {
  return {
    version: '1.0',
    analysisHistory: Array.isArray(value && value.analysisHistory) ? value.analysisHistory : [],
    lastAnalysis: value && value.lastAnalysis ? value.lastAnalysis : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function buildRouteAccuracy(routeScores = {}) {
  return Object.entries(normalizeObject(routeScores)).reduce((result, [routeKey, score]) => {
    const positive = Number(score && score.positive || 0);
    const negative = Number(score && score.negative || 0);
    const sampleCount = positive + negative;
    const accuracy = sampleCount > 0 ? Number((positive / sampleCount).toFixed(2)) : null;
    result[routeKey] = {
      routeKey,
      score: Number(score && score.score || 0),
      positive,
      negative,
      sampleCount,
      accuracy,
      confidence: Number(score && score.confidence || 0)
    };
    return result;
  }, {});
}

function detectOverloadedRoutes(memory = {}, strongRoutes = []) {
  const clusters = normalizeObject(memory.founderQuestionClusters && memory.founderQuestionClusters.clusters);
  const activeClusters = Object.values(clusters)
    .filter((cluster) => Number(cluster && cluster.count || 0) >= 5);
  return strongRoutes
    .filter((route) => route.routeKey === 'founder_mind_reconstruction' && activeClusters.length >= 3)
    .map((route) => ({
      ...route,
      activeClusterCount: activeClusters.length,
      activeClusters: activeClusters.map((cluster) => ({
        family: cluster.family,
        category: cluster.category,
        count: cluster.count
      }))
    }));
}

function suggestMerges(weakRoutes = [], strongRoutes = []) {
  const bestConversation = strongRoutes.find((route) => route.routeKey === 'founder_mind_reconstruction') ||
    strongRoutes[0] ||
    null;
  return weakRoutes.map((route) => ({
    type: 'MERGE_WEAK_ROUTE',
    routes: bestConversation ? [route.routeKey, bestConversation.routeKey] : [route.routeKey],
    reason: `${route.routeKey} has weak accuracy; prefer the nearest stronger conversation route until evidence improves.`,
    confidence: clamp(60 + route.negative * 5, 60, 88)
  }));
}

function suggestSplits(overloadedRoutes = [], memory = {}) {
  return overloadedRoutes.map((route) => ({
    type: 'SPLIT_OVERLOADED_ROUTE',
    routeKey: route.routeKey,
    proposedRoutes: route.activeClusters.map((cluster) => routeNameForCluster(cluster)),
    reason: `${route.routeKey} handles ${route.activeClusterCount} high-frequency founder question families and may be overloaded.`,
    confidence: clamp(58 + route.activeClusterCount * 6, 60, 88)
  }));
}

function suggestNewRoutes(founderQuestionClusters = {}) {
  const learned = Array.isArray(founderQuestionClusters && founderQuestionClusters.learnedClusters)
    ? founderQuestionClusters.learnedClusters
    : [];
  return learned
    .filter((cluster) => Number(cluster && cluster.count || 0) >= 3)
    .map((cluster) => ({
      type: 'CREATE_ROUTE_FROM_PATTERN',
      clusterId: cluster.clusterId,
      proposedRoute: routeNameForCluster(cluster),
      reason: `${cluster.family || cluster.clusterId} appeared repeatedly and may deserve a dedicated route.`,
      tokens: Array.isArray(cluster.tokens) ? cluster.tokens.slice(0, 8) : [],
      confidence: clamp(56 + Number(cluster.count || 0) * 6, 60, 88)
    }));
}

function buildRecommendations({
  weakRoutes = [],
  mergeSuggestions = [],
  splitSuggestions = [],
  newRouteSuggestions = []
} = {}) {
  const recommendations = [];
  if (weakRoutes.length) {
    recommendations.push('Review weak routes before adding more routing rules; repeated negative feedback means the current path is not earning trust.');
  }
  if (mergeSuggestions.length) {
    recommendations.push('Merge or downgrade weak fallback routes into stronger founder-thinking routes until accuracy improves.');
  }
  if (splitSuggestions.length) {
    recommendations.push('Split overloaded founder-thinking routes only when repeated question families prove distinct behavior is needed.');
  }
  if (newRouteSuggestions.length) {
    recommendations.push('Create new routes only from repeated semantic patterns, not one-off keywords.');
  }
  if (!recommendations.length) {
    recommendations.push('No route evolution needed yet; continue collecting route accuracy evidence.');
  }
  return recommendations;
}

function routeNameForCluster(cluster = {}) {
  const family = String(cluster.family || cluster.clusterId || 'learned route')
    .toLowerCase()
    .replace(/questions?/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `route_${family || 'learned_pattern'}`;
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  analyzeRouteEvolution,
  updateRouteEvolutionMemory,
  normalizeRouteEvolutionMemory,
  buildRouteAccuracy
};
