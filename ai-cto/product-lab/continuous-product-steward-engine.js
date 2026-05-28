const { runProductAwarenessLoop, PHASE } = require('./product-awareness-loop');
const { reduceFounderInterruptions } = require('./founder-interruption-reducer');

function runContinuousProductSteward(input = {}) {
  const awareness = runProductAwarenessLoop(input);
  const interruption = reduceFounderInterruptions({
    recommendations: [awareness.recommendation],
    maxDailyRecommendations: 1
  });
  return {
    phase: PHASE,
    mode: 'AUTONOMOUS_AWARENESS_ONLY',
    mutationAllowed: false,
    awareness,
    whatsappReady: interruption.messages,
    suppressedRecommendations: interruption.suppressedCount
  };
}

module.exports = { runContinuousProductSteward };
