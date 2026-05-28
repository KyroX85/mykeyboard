const { calmProductResponse } = require('./calm-response-engine');

function answerExecution({ route = {} } = {}) {
  if (!route.executionAllowed) {
    return calmProductResponse([
      'Execution request detected.',
      `I will not mutate files because ${route.reason}.`,
      'Conversation and analysis can continue; execution requires the governed path.'
    ]);
  }
  return calmProductResponse([
    'Execution request detected.',
    'Governance checks are required before any file mutation, commit, APK change, or protected-file edit.',
    'I will only proceed through the approved execution path.'
  ]);
}

module.exports = { answerExecution };
