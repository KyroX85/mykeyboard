const ALLOWED_SIGNAL_KEYS = Object.freeze([
  'correctionBursts',
  'swipeFailureClusters',
  'edgeKeyMissFrequency',
  'modeSwitchFrequency',
  'longWordSwipeAbandonment',
  'latencySpikes',
  'frameHitchSuspicion',
  'symbolHuntingFrequency',
  'repeatedRetryPatterns',
  'swipeAttempts',
  'swipeSuccesses',
  'backspaceClusters',
  'suggestionRejectionRuns'
]);

const RAW_CONTENT_KEY_PATTERN = /(raw|text|word|words|phrase|sentence|conversation|keystroke|keyhistory|swipepath|path|input|message)/i;
const MAX_SIGNAL_VALUE = 100000;

function sanitizeProductSignals(input = {}) {
  const rejectedKeys = [];
  const signals = {};

  for (const [key, value] of Object.entries(input || {})) {
    if (ALLOWED_SIGNAL_KEYS.includes(key)) {
      signals[key] = boundedCounter(value);
      continue;
    }
    if (RAW_CONTENT_KEY_PATTERN.test(key)) {
      rejectedKeys.push(key);
      continue;
    }
  }

  return {
    signals,
    rejectedKeys,
    privacySafe: rejectedKeys.length === 0
  };
}

function aggregateProductSignals(samples = []) {
  const aggregate = {};
  const rejectedKeys = new Set();

  for (const sample of samples) {
    const sanitized = sanitizeProductSignals(sample);
    sanitized.rejectedKeys.forEach((key) => rejectedKeys.add(key));
    for (const [key, value] of Object.entries(sanitized.signals)) {
      aggregate[key] = boundedCounter((aggregate[key] || 0) + value);
    }
  }

  return {
    signals: aggregate,
    rejectedKeys: [...rejectedKeys],
    privacySafe: rejectedKeys.size === 0,
    sampleCount: samples.length
  };
}

function summarizeFrictionSignals(signals = {}) {
  const clean = sanitizeProductSignals(signals).signals;
  const swipeFailurePressure = ratio(valueOf(clean, 'swipeFailureClusters') + valueOf(clean, 'longWordSwipeAbandonment'), valueOf(clean, 'swipeAttempts'));
  const correctionPressure = scoreFrom(valueOf(clean, 'correctionBursts') + valueOf(clean, 'backspaceClusters') + valueOf(clean, 'repeatedRetryPatterns'));
  const symbolPressure = scoreFrom(valueOf(clean, 'modeSwitchFrequency') + valueOf(clean, 'symbolHuntingFrequency'));
  const responsivenessPressure = scoreFrom(valueOf(clean, 'latencySpikes') + valueOf(clean, 'frameHitchSuspicion'));
  const edgePressure = scoreFrom(valueOf(clean, 'edgeKeyMissFrequency'));
  const suggestionPressure = scoreFrom(valueOf(clean, 'suggestionRejectionRuns'));
  const trustCollapsePressure = Math.max(
    swipeFailurePressure,
    correctionPressure,
    scoreFrom(valueOf(clean, 'repeatedRetryPatterns') + valueOf(clean, 'swipeFailureClusters'))
  );

  return {
    swipeFailurePressure,
    correctionPressure,
    symbolPressure,
    responsivenessPressure,
    edgePressure,
    suggestionPressure,
    trustCollapsePressure,
    overallFriction: Math.max(
      swipeFailurePressure,
      correctionPressure,
      symbolPressure,
      responsivenessPressure,
      edgePressure,
      suggestionPressure,
      trustCollapsePressure
    )
  };
}

function detectRepeatedPainPatterns(signals = {}) {
  const clean = sanitizeProductSignals(signals).signals;
  const correctionPain = valueOf(clean, 'correctionBursts') + valueOf(clean, 'backspaceClusters');
  const swipePain = valueOf(clean, 'swipeFailureClusters') + valueOf(clean, 'longWordSwipeAbandonment');
  const retryPain = valueOf(clean, 'repeatedRetryPatterns');
  const modeSwitchPain = valueOf(clean, 'modeSwitchFrequency') + valueOf(clean, 'symbolHuntingFrequency');

  return {
    correctionPainHigh: correctionPain >= 8,
    swipePainHigh: swipePain >= 6,
    retryPainHigh: retryPain >= 5,
    modeSwitchPainHigh: modeSwitchPain >= 9,
    trustCollapseRisk: swipePain + correctionPain + retryPain >= 14
  };
}

function valueOf(signals, key) {
  return boundedCounter(signals[key] || 0);
}

function boundedCounter(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(MAX_SIGNAL_VALUE, Math.floor(number));
}

function scoreFrom(value) {
  return Math.min(100, Math.round((boundedCounter(value) / 12) * 100));
}

function ratio(numerator = 0, denominator = 0) {
  const safeDenominator = boundedCounter(denominator);
  if (safeDenominator === 0) return 0;
  return Math.min(100, Math.round((boundedCounter(numerator) * 100) / safeDenominator));
}

module.exports = {
  ALLOWED_SIGNAL_KEYS,
  aggregateProductSignals,
  detectRepeatedPainPatterns,
  sanitizeProductSignals,
  summarizeFrictionSignals
};
