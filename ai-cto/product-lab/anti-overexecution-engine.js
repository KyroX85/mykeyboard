const { decideIntentDominance } = require('./intent-dominance-engine');

function preventOverexecution({ message = '', proposedMode = 'CONVERSATION' } = {}) {
  const dominance = decideIntentDominance(message);
  if (proposedMode === 'EXECUTION' && dominance.intent !== 'EXECUTION') {
    return {
      prevented: true,
      mode: dominance.intent === 'THINKING' ? 'THINKING' : 'CONVERSATION',
      reason: 'founder appears to be discussing, not commanding'
    };
  }
  return {
    prevented: false,
    mode: proposedMode,
    reason: 'no overexecution detected'
  };
}

module.exports = { preventOverexecution };
