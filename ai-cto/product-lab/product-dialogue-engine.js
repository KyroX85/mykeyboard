const { calmProductResponse } = require('./calm-response-engine');

function answerProductLabDialogue({ productContext = {} } = {}) {
  return calmProductResponse([
    'I would treat this as screenshot comparison, not execution.',
    `visual evidence to inspect: ${productContext.recurringFriction || 'spacing, density, edge-key risk, symbol travel, and dark-mode readability'}.`,
    'Any fix should wait until the comparison points to a bounded Phase 1 product issue.'
  ]);
}

module.exports = { answerProductLabDialogue };
