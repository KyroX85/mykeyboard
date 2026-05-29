const { detectProductDiscussion } = require('./product-discussion-detector');

function assumeGoodIntent(message = '') {
  const product = detectProductDiscussion(message);
  return {
    assumeGoodIntent: product.isProductDiscussion || product.confidence >= 55,
    confidence: product.confidence,
    reason: product.isProductDiscussion
      ? 'founder appears to be discussing product quality'
      : 'default to conversational interpretation unless nonsense is clear'
  };
}

module.exports = { assumeGoodIntent };
