const { answerNaturalProductDiscussion } = require('./natural-product-discussion-engine');

function answerLightweightConversation(input = {}) {
  const answer = answerNaturalProductDiscussion(input);
  return answer.length <= 280 ? answer : `${answer.slice(0, 277).trim()}...`;
}

module.exports = { answerLightweightConversation };
