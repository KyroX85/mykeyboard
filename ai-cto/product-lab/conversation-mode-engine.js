const { calmProductResponse } = require('./calm-response-engine');

function answerConversation({ message = '', productContext = {}, memory = {} } = {}) {
  const text = String(message).toLowerCase();
  if (text.includes('hurt') && text.includes('trust')) {
    return calmProductResponse([
      `Current highest trust pressure appears to be ${productContext.highestPressure || 'the highest recurring Phase 1 friction still visible in evidence'}.`,
      `Evidence confidence: ${productContext.evidenceConfidence || 'limited'}.`,
      `Trust impact: ${productContext.trustImpact || 'unknown until more product-lab cycles exist'}.`,
      `I would not change code from this question alone; I would keep this as product discussion unless you approve a bounded experiment.`
    ]);
  }
  if (text.includes('stable') || text.includes('no change') || text.includes('safer')) {
    return calmProductResponse([
      'No change can be the right product decision when evidence is weak or the current trend is stable.',
      `Compared with ${productContext.saferThan || 'architecture work'}, stability is usually safer for Phase 1 typing trust.`
    ]);
  }
  if (text.includes('recurring friction')) {
    return calmProductResponse([
      `Recurring friction: ${productContext.recurringFriction || 'not enough repeated evidence yet'}.`,
      'I would watch for repeated discomfort before recommending a patch.'
    ]);
  }
  return calmProductResponse([
    `I am tracking this as ${memory.currentTopic || 'product conversation'}.`,
    'We can discuss tradeoffs without starting execution.'
  ]);
}

module.exports = { answerConversation };
