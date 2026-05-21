function buildConversationMemory({ agent, intent, topic, state, priorMemory = {} }) {
  const sections = state.sections || {};
  const changed = state.changed || {};
  const continuity = priorMemory.currentContinuity || {};
  const latestUnresolvedIssue = first(sections.unresolved) || first(sections.risks) || priorMemory.latestUnresolvedIssue || null;
  const latestImprovement = first(sections.completedFixes) || first(changed.completed) || priorMemory.latestImprovement || null;
  const latestWarning = first(sections.risks) || first(changed.newRisks) || priorMemory.latestWarning || null;
  const latestBlocker = first(sections.repeatedFailures) || latestUnresolvedIssue || priorMemory.latestBlocker || null;
  const activeTask = topic || first(sections.nextPriority) || priorMemory.lastActiveTask || null;

  return {
    ...priorMemory,
    lastAgentInteraction: agent || priorMemory.lastAgentInteraction || null,
    lastIntent: intent || priorMemory.lastIntent || null,
    lastDiscussedTopic: topic || priorMemory.lastDiscussedTopic || intent || null,
    lastUnfinishedConcern: latestUnresolvedIssue || priorMemory.lastUnfinishedConcern || null,
    lastMentionedBlocker: latestBlocker || priorMemory.lastMentionedBlocker || null,
    lastActiveTask: activeTask,
    latestUnresolvedIssue,
    latestImprovement,
    latestWarning,
    latestMomentumState: state.momentum || priorMemory.latestMomentumState || null,
    lastHealthScore: state.healthScore == null ? priorMemory.lastHealthScore || null : state.healthScore
    ,
    lastFounderTone: continuity.founderTone || priorMemory.lastFounderTone || null,
    lastDiscussedFrustration: continuity.frustration || priorMemory.lastDiscussedFrustration || null,
    unresolvedConcern: latestUnresolvedIssue || priorMemory.unresolvedConcern || null,
    repeatedPainPoints: mergePainPoint(priorMemory.repeatedPainPoints, continuity.painPoint),
    recentWins: mergePainPoint(priorMemory.recentWins, latestImprovement),
    founderPreferredWording: continuity.preferredWording || priorMemory.founderPreferredWording || null
  };
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function mergePainPoint(items, value) {
  const list = Array.isArray(items) ? items : [];
  if (!value) return list.slice(0, 5);
  return [value, ...list.filter((item) => item !== value)].slice(0, 5);
}

module.exports = {
  buildConversationMemory
};
