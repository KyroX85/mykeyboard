const { decideIntentDominance } = require('./intent-dominance-engine');
const { executionActivationDecision } = require('./execution-activation-engine');
const { shouldGenerateReport } = require('./report-optional-engine');
const { answerLightweightConversation } = require('./lightweight-conversation-engine');
const { preventOverexecution } = require('./anti-overexecution-engine');

function routeConversationFirst({ message = '', productContext = {}, governanceMode = 'ACTIVE' } = {}) {
  const dominance = decideIntentDominance(message);
  const activation = executionActivationDecision(message);
  const report = shouldGenerateReport(message);
  const proposedMode = activation.executionRequested ? 'EXECUTION' : dominance.intent;
  const overexecution = preventOverexecution({ message, proposedMode });
  const mode = overexecution.mode;

  if (mode !== 'EXECUTION') {
    return {
      mode,
      mutationAllowed: false,
      reportGenerationAllowed: false,
      response: answerLightweightConversation({ message, productContext }),
      dominance,
      overexecution
    };
  }

  const blocked = governanceMode === 'PRESERVATION_ONLY';
  return {
    mode: 'EXECUTION',
    mutationAllowed: !blocked && !report.allowed,
    reportGenerationAllowed: report.allowed && !blocked,
    response: blocked
      ? 'Execution intent is explicit, but PRESERVATION_ONLY blocks mutation before execution starts.'
      : `Execution intent is explicit through ${activation.activationWord}. Governance must run before any mutation.`,
    dominance,
    overexecution
  };
}

module.exports = { routeConversationFirst };
