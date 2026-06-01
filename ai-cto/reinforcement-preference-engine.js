const MAX_PREFERENCE_HISTORY = 30;

const PREFERENCE_KEYS = [
  'reflection',
  'strategy',
  'product_truth',
  'user_value',
  'health_report',
  'momentum_report',
  'task_plan',
  'cto_report',
  'generic_template'
];

function buildReinforcementPreferences(memory = {}) {
  const weights = blankWeights();
  const evidence = {
    positive: [],
    negative: []
  };

  for (const item of array(memory.founderFeedback)) {
    applyFeedback(weights, evidence, item);
  }

  for (const event of array(memory.reinforcementEvents)) {
    applyRewardEvent(weights, evidence, event);
  }

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    weights: clampWeights(weights),
    prefer: preferenceList(weights, 1),
    avoid: preferenceList(weights, -1),
    evidence,
    confidence: preferenceConfidence(evidence)
  };
}

function updateReinforcementPreferenceMemory(existing = {}, preferences = null) {
  const current = normalizePreferenceMemory(existing);
  if (!preferences) return current;
  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastPreferences: preferences,
    history: [preferences, ...current.history].slice(0, MAX_PREFERENCE_HISTORY)
  };
}

function normalizePreferenceMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastPreferences: source.lastPreferences || null,
    history: Array.isArray(source.history)
      ? source.history.filter(Boolean).slice(0, MAX_PREFERENCE_HISTORY)
      : []
  };
}

function applyReinforcementPreferencesToRoute(route = {}, memory = {}) {
  const preferences = resolvePreferences(memory);
  if (!preferences || !shouldApplyToRoute(route)) return route;

  const avoid = Array.isArray(preferences.avoid)
    ? preferences.avoid
    : preferenceList(preferences.weights || {}, -1);
  const prefer = Array.isArray(preferences.prefer)
    ? preferences.prefer
    : preferenceList(preferences.weights || {}, 1);
  const originalResponse = String(route.response || '');
  const cleaned = stripRejectedPreferenceLines(originalResponse, avoid);
  const applied = cleaned !== originalResponse;

  return {
    ...route,
    response: cleaned,
    details: {
      ...(route.details || {}),
      reinforcementPreferencesApplied: applied,
      reinforcementPreferences: {
        prefer,
        avoid,
        confidence: preferences.confidence || 0
      }
    }
  };
}

function shouldApplyToRoute(route = {}) {
  const command = String(route.command || '');
  const details = route.details || {};
  if (/\b(build|scan|screenshot|execution|approval|commit|push)\b/i.test(command)) {
    return false;
  }
  return Boolean(
    details.skipExecutionSchema ||
    command === 'founder_mind_reconstruction' ||
    command === 'conversational_fallback' ||
    command === 'agent'
  );
}

function resolvePreferences(memory = {}) {
  if (memory.reinforcementPreferenceMemory && memory.reinforcementPreferenceMemory.lastPreferences) {
    return memory.reinforcementPreferenceMemory.lastPreferences;
  }
  if (memory.reinforcementPreferences) return memory.reinforcementPreferences;
  return null;
}

function stripRejectedPreferenceLines(response = '', avoid = []) {
  if (!avoid.length) return response;
  const blocked = blockedLinePatterns(avoid);
  if (!blocked.length) return response;
  const lines = String(response || '').split(/\r?\n/);
  const kept = lines.filter((line) => !blocked.some((pattern) => pattern.test(line.trim())));
  const next = kept.join('\n').trim();
  return next || String(response || '').trim();
}

function blockedLinePatterns(avoid = []) {
  const patterns = [];
  if (avoid.includes('health_report')) patterns.push(/^health\b/i, /^current foundation health:/i);
  if (avoid.includes('momentum_report')) patterns.push(/^momentum\b/i);
  if (avoid.includes('task_plan')) patterns.push(/^task plan:/i, /^execution plan/i, /^approve\b/i);
  if (avoid.includes('cto_report')) {
    patterns.push(/^current foundation health:/i, /^phase 2 opportunities:/i, /^trust risk:/i, /^recommended next step:/i);
  }
  if (avoid.includes('generic_template')) patterns.push(/^highest leverage differentiator:/i, /^recommended next step:/i);
  return patterns;
}

function applyFeedback(weights, evidence, item = {}) {
  const direction = item.polarity === 'positive' ? 1 : item.polarity === 'negative' ? -1 : 0;
  if (!direction) return;
  const text = `${item.feedback || ''} ${item.adaptation || ''} ${item.answerPattern || ''}`;
  const matched = preferenceKeysForText(text);
  for (const key of matched) {
    weights[key] += direction > 0 ? 2 : -2;
  }
  const bucket = direction > 0 ? evidence.positive : evidence.negative;
  bucket.push({
    source: 'founder_feedback',
    feedback: item.feedback || null,
    polarity: item.polarity || null,
    keys: matched,
    confidence: item.confidence || null
  });
}

function applyRewardEvent(weights, evidence, event = {}) {
  const reward = Number(event.reward || 0);
  if (!reward) return;
  const text = `${event.routeKey || ''} ${event.rewardLabel || ''} ${event.answerPattern || ''}`;
  const matched = preferenceKeysForText(text);
  for (const key of matched) {
    weights[key] += reward > 0 ? 1 : -1;
  }
  const bucket = reward > 0 ? evidence.positive : evidence.negative;
  bucket.push({
    source: 'reinforcement_event',
    reward,
    routeKey: event.routeKey || null,
    keys: matched
  });
}

function preferenceKeysForText(text = '') {
  const value = String(text || '').toLowerCase();
  const keys = [];
  if (/reflection|dream|concern|actual question|mind reconstruction|founder_mind/.test(value)) keys.push('reflection');
  if (/strategy|strategic|tradeoff|opportunity cost|premortem/.test(value)) keys.push('strategy');
  if (/truth|reality|evidence|disagree|not agree/.test(value)) keys.push('product_truth');
  if (/user value|user pain|users care|would user|retention/.test(value)) keys.push('user_value');
  if (/health|foundation health/.test(value)) keys.push('health_report');
  if (/momentum|stalled/.test(value)) keys.push('momentum_report');
  if (/task plan|execution plan|approve|file modification/.test(value)) keys.push('task_plan');
  if (/cto mode|status|report|current foundation health|recommended next step/.test(value)) keys.push('cto_report');
  if (/generic|vague|template|highest leverage differentiator/.test(value)) keys.push('generic_template');
  return keys.length ? unique(keys) : ['product_truth'];
}

function blankWeights() {
  return PREFERENCE_KEYS.reduce((weights, key) => ({ ...weights, [key]: 0 }), {});
}

function clampWeights(weights = {}) {
  return PREFERENCE_KEYS.reduce((result, key) => ({
    ...result,
    [key]: clamp(Number(weights[key] || 0), -10, 10)
  }), {});
}

function preferenceList(weights = {}, direction = 1) {
  return Object.entries(clampWeights(weights))
    .filter(([, value]) => direction > 0 ? value > 0 : value < 0)
    .sort((a, b) => direction > 0 ? b[1] - a[1] : a[1] - b[1])
    .map(([key]) => key);
}

function preferenceConfidence(evidence = {}) {
  const total = array(evidence.positive).length + array(evidence.negative).length;
  return clamp(45 + total * 7, 45, 90);
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

module.exports = {
  buildReinforcementPreferences,
  updateReinforcementPreferenceMemory,
  normalizePreferenceMemory,
  applyReinforcementPreferencesToRoute,
  stripRejectedPreferenceLines
};
