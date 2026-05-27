const { summarizeFrictionSignals } = require('./product-signal-pipeline');

const PHASE1_PRIORITY_ORDER = [
  'typingFeel',
  'swipeTrust',
  'responsiveness',
  'correctionBurden',
  'symbolErgonomics',
  'longSessionStability',
  'installReliability',
  'darkModeReadability',
  'batteryEfficiency',
  'regressionPrevention'
];

function computePressureSummary(signals = {}, trustMap = {}, trend = {}, governance = {}) {
  const friction = summarizeFrictionSignals(signals);
  const map = {
    typingFeel: severity(Math.max(friction.correctionPressure, friction.edgePressure)),
    swipeTrust: severity(friction.swipeFailurePressure),
    responsiveness: severity(friction.responsivenessPressure),
    correctionBurden: severity(friction.correctionPressure),
    symbolErgonomics: severity(friction.symbolPressure),
    longSessionStability: severity(Math.max(friction.responsivenessPressure, friction.correctionPressure)),
    installReliability: severity(Number(trend.installFailurePressure || 0)),
    darkModeReadability: severity(Number(trend.darkModeFatiguePressure || 0)),
    batteryEfficiency: severity(Number(trend.batteryPressure || 0)),
    regressionPrevention: severity(Number(trend.regressionPressure || 0))
  };

  const feed = buildAgentPriorityFeed(map, trustMap, governance);
  return { pressures: map, feed };
}

function buildAgentPriorityFeed(pressures = {}, trustMap = {}, governance = {}) {
  return Object.entries(pressures)
    .map(([name, level]) => ({
      name,
      level,
      trust: Number(trustMap[name] || 70),
      governanceFreeze: Array.isArray(governance.frozenSubsystems) && governance.frozenSubsystems.includes(name)
    }))
    .sort((a, b) => rankLevel(b.level) - rankLevel(a.level) || phaseRank(a.name) - phaseRank(b.name));
}

function phaseRank(name) {
  const i = PHASE1_PRIORITY_ORDER.indexOf(name);
  return i < 0 ? 999 : i;
}

function severity(value) {
  const score = Number(value || 0);
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function rankLevel(level) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level] || 0;
}

module.exports = {
  PHASE1_PRIORITY_ORDER,
  computePressureSummary,
  buildAgentPriorityFeed
};

