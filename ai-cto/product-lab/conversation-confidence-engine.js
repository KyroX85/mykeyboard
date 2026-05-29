const { detectProductDiscussion } = require('./product-discussion-detector');

function estimateConversationConfidence(message = '') {
  const product = detectProductDiscussion(message);
  const words = String(message || '').trim().split(/\s+/).filter(Boolean);
  const score = product.isProductDiscussion
    ? Math.min(100, product.confidence + Math.min(10, words.length))
    : Math.min(60, words.length * 8);
  return {
    score,
    level: score >= 80 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW',
    productDiscussion: product.isProductDiscussion
  };
}

module.exports = { estimateConversationConfidence };
