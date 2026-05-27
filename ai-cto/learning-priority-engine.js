const { summarizeFrictionSignals } = require('./product-signal-pipeline');

const PRIORITY_WEIGHTS = Object.freeze({
  typingTrust: 1.0,
  correctionReduction: 0.95,
  swipeConfidence: 0.95,
  responsiveness: 0.9,
  visualClarity: 0.55,
  rhythmStability: 0.85,
  architectureCleanup: 0.1,
  abstractions: 0.05,
  cosmeticModernization: 0.05,
  aiSophistication: 0.0
});

const BLOCKED_ACTION_PATTERNS = [
  /autonomously?\s+(edit|change|mutate|rewrite)/i,
  /hot[- ]?path\s+(edit|mutation|change)/i,
  /rewrite\s+(swipe|predictor|layout)/i,
  /auto[- ]?tune/i,
  /cloud\s+(ai|learning|telemetry)/i
];

function rankLearningPriorities(signals = {}) {
  const friction = summarizeFrictionSignals(signals);
  const priorities = [
    priority('typing trust', friction.trustCollapsePressure, PRIORITY_WEIGHTS.typingTrust),
    priority('correction reduction', friction.correctionPressure, PRIORITY_WEIGHTS.correctionReduction),
    priority('swipe confidence', friction.swipeFailurePressure, PRIORITY_WEIGHTS.swipeConfidence),
    priority('responsiveness', friction.responsivenessPressure, PRIORITY_WEIGHTS.responsiveness),
    priority('rhythm stability', Math.max(friction.correctionPressure, friction.swipeFailurePressure), PRIORITY_WEIGHTS.rhythmStability),
    priority('visual clarity', friction.symbolPressure, PRIORITY_WEIGHTS.visualClarity),
    priority('architecture cleanup', 10, PRIORITY_WEIGHTS.architectureCleanup),
    priority('abstractions', 10, PRIORITY_WEIGHTS.abstractions),
    priority('cosmetic modernization', 10, PRIORITY_WEIGHTS.cosmeticModernization),
    priority('AI sophistication', 10, PRIORITY_WEIGHTS.aiSophistication)
  ];

  return priorities.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function blockUnsafeLearningAction(action = '') {
  const text = String(action || '');
  const matched = BLOCKED_ACTION_PATTERNS.find((pattern) => pattern.test(text));
  return {
    blocked: Boolean(matched),
    reason: matched
      ? 'Learning loop may observe, rank, summarize, and propose only. It may not mutate protected hot paths.'
      : null,
    allowedModes: ['observe', 'rank', 'summarize', 'propose']
  };
}

function priority(name, pressure, weight) {
  return {
    name,
    pressure,
    score: Math.round(pressure * weight),
    actionMode: 'propose-only'
  };
}

module.exports = {
  PRIORITY_WEIGHTS,
  blockUnsafeLearningAction,
  rankLearningPriorities
};
