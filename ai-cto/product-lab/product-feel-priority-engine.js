const WEIGHTS = {
  recurringFriction: ['recurring friction', 1.3],
  trustErosion: ['trust erosion', 1.25],
  typingInterruption: ['typing interruption', 1.2],
  correctionBurden: ['correction burden', 1.15],
  visualDiscomfort: ['visual discomfort', 1.05],
  thumbConfidence: ['thumb confidence', 1.05],
  swipeHesitation: ['swipe hesitation', 1.0],
  installUpdateStability: ['install/update stability', 0.95],
  fatigue: ['fatigue', 0.9],
  regressionPrevention: ['regression prevention', 0.9],
  architectureCleanup: ['architecture cleanup', 0.15],
  sophistication: ['sophistication', 0.05]
};

function rankProductFeelPriorities(signals = {}) {
  return Object.entries(WEIGHTS)
    .map(([key, [name, weight]]) => ({
      key,
      name,
      score: Math.round(Number(signals[key] || 0) * weight * 10)
    }))
    .sort((a, b) => b.score - a.score || orderIndex(a.key) - orderIndex(b.key));
}

function orderIndex(key) {
  return Object.keys(WEIGHTS).indexOf(key);
}

module.exports = { rankProductFeelPriorities };
