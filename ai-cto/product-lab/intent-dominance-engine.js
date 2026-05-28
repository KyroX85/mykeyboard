const { executionActivationDecision } = require('./execution-activation-engine');

const CONVERSATION_TERMS = /\b(what|why|how|should|would|could|compare|analyze|summarize|explain|discuss|think|evaluate|review|feels|hurts|worries|dislike|immature|unpolished|gboard|swiftkey|trust|retention|friction|stable|safer)\b/i;
const THINKING_TERMS = /\b(analyze|evaluate|review|rank|prioritize|recommend|estimate|tradeoff|risk|pressure|safest)\b/i;

function decideIntentDominance(message = '') {
  const text = String(message || '');
  const activation = executionActivationDecision(text);
  if (CONVERSATION_TERMS.test(text) && !activation.executionRequested) {
    return {
      intent: THINKING_TERMS.test(text) ? 'THINKING' : 'CONVERSATION',
      conversationFirst: true,
      reason: 'product discussion dominates because no explicit execution approval exists'
    };
  }
  if (activation.executionRequested) {
    return {
      intent: 'EXECUTION',
      conversationFirst: false,
      reason: activation.reason,
      activationWord: activation.activationWord
    };
  }
  return {
    intent: 'CONVERSATION',
    conversationFirst: true,
    reason: 'uncertain intent defaults to discussion'
  };
}

module.exports = { decideIntentDominance };
