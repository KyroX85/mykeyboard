const { decideIntentDominance } = require('./intent-dominance-engine');
const { executionActivationDecision } = require('./execution-activation-engine');
const { shouldGenerateReport } = require('./report-optional-engine');
const { answerLightweightConversation } = require('./lightweight-conversation-engine');
const { preventOverexecution } = require('./anti-overexecution-engine');
const { detectProductDiscussion } = require('./product-discussion-detector');
const { answerCalmDialogue } = require('./calm-dialogue-engine');
const { reduceParanoia } = require('./anti-paranoia-engine');

function routeConversationFirst({ message = '', productContext = {}, governanceMode = 'ACTIVE' } = {}) {
  const dominance = decideIntentDominance(message);
  const productDiscussion = detectProductDiscussion(message);
  const activation = executionActivationDecision(message);
  const report = shouldGenerateReport(message);
  const proposedMode = activation.executionRequested ? 'EXECUTION' : dominance.intent;
  const overexecution = preventOverexecution({ message, proposedMode });
  const mode = overexecution.mode;

  if (mode !== 'EXECUTION') {
    const response = productDiscussion.isProductDiscussion
      ? answerCalmDialogue({ message, productContext })
      : answerLightweightConversation({ message, productContext });
    return {
      mode,
      mutationAllowed: false,
      reportGenerationAllowed: false,
      response: reduceParanoia({ response, productDiscussion: productDiscussion.isProductDiscussion }).response,
      dominance,
      overexecution,
      productDiscussion
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
