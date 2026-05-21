const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_FILE = path.join(ROOT, 'ai-cto', '.whatsapp_memory.json');
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
  const next = {
    ...DEFAULT_MEMORY,
    ...memory,
    version: DEFAULT_MEMORY.version,
    lastUpdatedAt: new Date().toISOString()
  };

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

  return writeMemory({
    ...memory,
    lastCommand: command,
    lastRequestedFocusArea: details.focusTopic || memory.lastRequestedFocusArea,
    latestUnresolvedIssue,
    lastHealthScore: state.healthScore == null ? memory.lastHealthScore : state.healthScore,
    latestMomentumState: state.momentum || memory.latestMomentumState
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
    founderPreferredWording: memory.founderPreferredWording || null
  };
}

function updateConversationMemory(route, state) {
  const memory = readConversationMemory();
  const sections = state.sections || {};
  const changed = state.changed || {};
  const continuity = route.continuity || {};
  const activeTasks = deriveActiveTasks(state);
  const next = {
    ...memory,
    lastAgentInteraction: route.agent || memory.lastAgentInteraction,
    lastFocusTopic: route.focusTopic || memory.lastFocusTopic,
    lastRequestedFocusArea: route.focusTopic || memory.lastRequestedFocusArea,
    latestUnresolvedIssue: state.sections.unresolved[0] || state.sections.risks[0] || memory.latestUnresolvedIssue || null,
    lastHealthScore: state.healthScore == null ? memory.lastHealthScore : state.healthScore,
    latestMomentumState: state.momentum || memory.latestMomentumState,
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
    lastCommand: `agent:${route.agent}:${route.intent}`
  };
  return writeMemory(next);
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

module.exports = {
  readMemory,
  writeMemory,
  updateMemory,
  readConversationMemory,
  updateConversationMemory,
  deriveActiveTasks,
  MEMORY_FILE
};
