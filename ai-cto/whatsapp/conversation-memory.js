const { readMemory, writeMemory } = require('./memory-store');

function readConversationMemory() {
  const memory = readMemory();
  return {
    ...memory,
    lastAgentInteraction: memory.lastAgentInteraction || null,
    lastFocusTopic: memory.lastFocusTopic || memory.lastRequestedFocusArea || null,
    activeTasks: Array.isArray(memory.activeTasks) ? memory.activeTasks : [],
    currentSprintFocus: memory.currentSprintFocus || memory.lastRequestedFocusArea || null
  };
}

function updateConversationMemory(route, state) {
  const memory = readConversationMemory();
  const activeTasks = deriveActiveTasks(state);
  const next = {
    ...memory,
    lastAgentInteraction: route.agent || memory.lastAgentInteraction,
    lastFocusTopic: route.topic || memory.lastFocusTopic,
    lastRequestedFocusArea: route.topic || memory.lastRequestedFocusArea,
    latestUnresolvedIssue: state.sections.unresolved[0] || state.sections.risks[0] || memory.latestUnresolvedIssue || null,
    lastHealthScore: state.healthScore == null ? memory.lastHealthScore : state.healthScore,
    latestMomentumState: state.momentum || memory.latestMomentumState,
    activeTasks,
    currentSprintFocus: route.topic || state.sections.nextPriority[0] || memory.currentSprintFocus || null,
    lastCommand: `agent:${route.agent}:${route.intent}`
  };
  return writeMemory(next);
}

function deriveActiveTasks(state) {
  return [
    ...state.sections.nextPriority,
    ...state.sections.approvals,
    ...state.sections.completedFixes
  ]
    .filter(Boolean)
    .slice(0, 5);
}

module.exports = {
  readConversationMemory,
  updateConversationMemory,
  deriveActiveTasks
};
