const { calmProductResponse } = require('./calm-response-engine');

function answerThinking({ productContext = {} } = {}) {
  return calmProductResponse([
    `safest bounded recommendation: focus on ${productContext.highestPressure || 'the highest recurring Phase 1 trust pressure'}.`,
    `Why: it has more retention value than ${productContext.saferThan || 'architecture cleanup or speculative intelligence work'}.`,
    'Execution posture: prepare a small proposal, estimate regression risk, then wait for approval.',
    'No mutation should start from analysis alone.'
  ]);
}

module.exports = { answerThinking };
