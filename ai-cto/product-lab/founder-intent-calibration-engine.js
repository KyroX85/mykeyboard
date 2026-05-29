const { detectProductDiscussion } = require('./product-discussion-detector');

function calibrateFounderIntent(message = '') {
  const product = detectProductDiscussion(message);
  if (product.isProductDiscussion || product.confidence >= 70) {
    return {
      intent: 'PRODUCT_DISCUSSION',
      noiseAllowed: false,
      confidence: product.confidence
    };
  }
  return {
    intent: 'GENERAL_CONVERSATION',
    noiseAllowed: false,
    confidence: product.confidence
  };
}

module.exports = { calibrateFounderIntent };
