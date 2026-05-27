function scoreUserFeel(signals = {}) {
  const interruption = Number(signals.typingInterruptions || 0);
  const correction = Number(signals.correctionBursts || 0);
  const rhythm = Number(signals.rhythmBreaks || 0);
  const symbol = Number(signals.symbolToggles || 0);
  const swipe = Number(signals.swipeHesitation || 0);
  const latency = Number(signals.latencyPerceptionRisk || 0);
  const darkMode = Number(signals.darkModeStrain || 0);
  const fatigue = Math.min(100, interruption + correction + rhythm + symbol + swipe + latency + darkMode);
  return {
    feelScore: Math.max(0, 100 - fatigue),
    fatigueRisk: fatigue >= 70 ? 'HIGH' : fatigue >= 45 ? 'MEDIUM' : 'LOW'
  };
}

module.exports = { scoreUserFeel };

