const { estimateFounderMentalState } = require('./founder-mental-state-estimator');

const MAX_RECENT_STATES = 50;

const STATE_STYLES = Object.freeze({
  STRATEGIC_MODE: 'Compare tradeoffs, opportunity cost, second-order effects, and what gets delayed. Do not jump into execution.',
  PRODUCT_MODE: 'Judge user pain, habit, retention, trust, and whether users would notice or return. Keep the answer product-grounded.',
  FRUSTRATED_MODE: 'Answer direct and short with no templates, no health scores, and no defensive explanation. Reduce friction first.',
  VISION_MODE: 'Connect the dream, current alignment, and the gap to user-visible leverage. Avoid tactical noise.',
  EXECUTION_MODE: 'Use governance, verification, rollback awareness, and scoped implementation discipline.'
});

function detectFounderState(message = '', context = {}) {
  const text = String(message || '').trim();
  const normalized = text.toLowerCase();
  const mentalState = estimateFounderMentalState(text, context);
  const scores = initialScores(mentalState);
  const signals = [];

  applyPatternSignals(normalized, scores, signals);
  applyMentalStateSignals(mentalState, scores, signals);
  applyContinuity(context, scores, signals);

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [state, topScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  const confidence = topScore > 0
    ? clamp(50 + topScore * 6 - Math.max(0, secondScore - (topScore - 2)) * 4, 45, 92)
    : 40;
  const resolvedState = topScore > 0 ? state : 'PRODUCT_MODE';

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    messagePreview: text.slice(0, 220),
    state: resolvedState,
    displayName: displayName(resolvedState),
    confidence,
    responseStyle: STATE_STYLES[resolvedState],
    scores,
    signals,
    mentalState
  };
}

function applyFounderStateToRoute(route = {}, { message = '', context = {}, showFounderState = false } = {}) {
  if (!route || !route.response || !shouldApplyToRoute(route)) return route;
  const founderState = detectFounderState(message, context);
  const details = {
    ...(route.details || {}),
    founderState,
    responseStyle: founderState.responseStyle
  };
  return {
    ...route,
    details,
    response: showFounderState ? appendStateLine(route.response, founderState) : route.response
  };
}

function updateFounderStateMemory(existing = {}, state = null) {
  const model = normalizeFounderStateMemory(existing);
  if (!state || !state.state) return model;
  const stateCounts = {
    ...model.stateCounts,
    [state.state]: (model.stateCounts[state.state] || 0) + 1
  };
  return {
    version: '1.0',
    recentStates: [state, ...model.recentStates].slice(0, MAX_RECENT_STATES),
    stateCounts,
    lastState: state,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeFounderStateMemory(value = {}) {
  return {
    version: '1.0',
    recentStates: Array.isArray(value && value.recentStates) ? value.recentStates : [],
    stateCounts: value && value.stateCounts && typeof value.stateCounts === 'object' ? value.stateCounts : {},
    lastState: value && value.lastState ? value.lastState : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function initialScores(mentalState = {}) {
  return {
    STRATEGIC_MODE: mentalState.primaryState === 'STRATEGY' ? 3 : 0,
    PRODUCT_MODE: 0,
    FRUSTRATED_MODE: mentalState.primaryState === 'FRUSTRATION' ? 4 : 0,
    VISION_MODE: mentalState.primaryState === 'VISION' ? 4 : 0,
    EXECUTION_MODE: 0
  };
}

function applyPatternSignals(text, scores, signals) {
  addIf(/\b(what happens if|tradeoff|opportunity cost|prioritize|focus only|six months|strategy|which path|dangerous assumption)\b/.test(text),
    scores, signals, 'STRATEGIC_MODE', 5, 'strategic tradeoff language');
  addIf(/\b(users?|user pain|care|pay|return|habit|retention|feature|product|daily|would users|killer)\b/.test(text),
    scores, signals, 'PRODUCT_MODE', 5, 'user/product value language');
  addIf(/\b(annoying|frustrated|tired|bro.*not|wrong|bad|generic|same answer|not listening|missing what i mean)\b/.test(text),
    scores, signals, 'FRUSTRATED_MODE', 6, 'founder frustration language');
  addIf(/\b(dream|vision|chasing|company goal|phone intelligence|jarvis|future|world look like|ambition)\b/.test(text),
    scores, signals, 'VISION_MODE', 6, 'dream or vision language');
  addIf(/\b(implement|fix|execute|commit|push|build|modify|create file|apply patch|run test|do this)\b/.test(text),
    scores, signals, 'EXECUTION_MODE', 7, 'explicit execution language');
}

function applyMentalStateSignals(mentalState = {}, scores, signals) {
  if (mentalState.primaryState === 'DOUBT') {
    scores.STRATEGIC_MODE += 2;
    signals.push({ state: 'STRATEGIC_MODE', weight: 2, label: 'mental-state doubt implies strategic discussion' });
  }
  if (mentalState.primaryState === 'CURIOSITY') {
    scores.PRODUCT_MODE += 1;
    signals.push({ state: 'PRODUCT_MODE', weight: 1, label: 'curiosity defaults to product discussion unless execution is explicit' });
  }
}

function applyContinuity(context = {}, scores, signals) {
  const previous = context.previousFounderState ||
    (context.founderStateMemory && context.founderStateMemory.lastState);
  if (!previous || !previous.state || scores[previous.state] == null) return;
  const highest = Math.max(...Object.values(scores));
  if (highest > 0 && highest <= 3) {
    scores[previous.state] += 1;
    signals.push({ state: previous.state, weight: 1, label: 'weak-signal founder-state continuity' });
  }
}

function addIf(condition, scores, signals, state, weight, label) {
  if (!condition) return;
  scores[state] += weight;
  signals.push({ state, weight, label });
}

function shouldApplyToRoute(route = {}) {
  const command = String(route.command || route.details && route.details.intent || '');
  if (/(build|scan|screenshot|commit|push|approval|approve|execution|execute|fix|preservation|product[_-]?lab)/i.test(command)) {
    return false;
  }
  const details = route.details || {};
  if (details.skipFounderStateDetection) return false;
  return true;
}

function appendStateLine(response = '', founderState = {}) {
  if (String(response || '').includes('Founder State:')) return response;
  return [
    `Founder State: ${founderState.displayName}`,
    `Response Style: ${founderState.responseStyle}`,
    String(response || '').trim()
  ].filter(Boolean).join('\n');
}

function displayName(state = '') {
  return String(state || 'PRODUCT_MODE')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

module.exports = {
  detectFounderState,
  applyFounderStateToRoute,
  updateFounderStateMemory,
  normalizeFounderStateMemory
};
