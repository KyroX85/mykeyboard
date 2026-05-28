const { classifyLowInformationV2 } = require('./low-information-classifier-v2');
const { selectOperationalMode, formatModeMenu } = require('./mode-selection-engine');
const { rememberConversationTurn } = require('./conversational-memory-engine');
const { routeGovernanceSeparation } = require('./governance-separation-layer');
const { answerConversation } = require('./conversation-mode-engine');
const { answerThinking } = require('./thinking-mode-engine');
const { answerExecution } = require('./execution-mode-engine');
const { answerProductLabDialogue } = require('./product-dialogue-engine');

function handleHumanProductConversation({
  root = process.cwd(),
  message = '',
  productContext = {},
  governanceMode = 'ACTIVE'
} = {}) {
  const selection = selectOperationalMode(message);
  if (selection.mode === 'MODE_SELECTION') {
    rememberConversationTurn({ root, message, mode: 'MODE_SELECTION', topic: 'mode selection' });
    return {
      mode: 'MODE_SELECTION',
      mutationAllowed: false,
      response: formatModeMenu()
    };
  }

  const lowInfo = classifyLowInformationV2(message);
  if (lowInfo.classification === 'LOW_INFORMATION') {
    return {
      mode: 'CONVERSATION',
      mutationAllowed: false,
      response: 'LOW INFORMATION DETECTED. I do not see a product question or engineering intent here, so I will not start analysis or execution.'
    };
  }

  const route = routeGovernanceSeparation({ message, governanceMode });
  const memory = rememberConversationTurn({
    root,
    message,
    mode: route.mode,
    topic: topicFor(route.mode, message),
    subsystemFocus: productContext.subsystemFocus || ''
  });

  if (route.mode === 'EXECUTION') {
    return {
      mode: 'EXECUTION',
      mutationAllowed: route.executionAllowed,
      response: answerExecution({ route })
    };
  }
  if (route.mode === 'THINKING') {
    return {
      mode: 'THINKING',
      mutationAllowed: false,
      response: answerThinking({ productContext, memory })
    };
  }
  if (route.mode === 'PRODUCT_LAB') {
    return {
      mode: 'PRODUCT_LAB',
      mutationAllowed: false,
      response: answerProductLabDialogue({ productContext, memory })
    };
  }
  if (route.mode === 'PRESERVATION') {
    return {
      mode: 'PRESERVATION',
      mutationAllowed: false,
      response: 'Preservation mode is an execution posture. Conversation, product analysis, reports, and screenshot review remain available; mutation stays blocked when preservation is active.'
    };
  }
  return {
    mode: 'CONVERSATION',
    mutationAllowed: false,
    response: answerConversation({ message, productContext, memory })
  };
}

function topicFor(mode, message) {
  if (mode === 'PRODUCT_LAB') return 'screenshot comparison';
  if (mode === 'THINKING') return 'product prioritization';
  if (mode === 'EXECUTION') return 'governed execution';
  if (String(message).toLowerCase().includes('trust')) return 'typing trust';
  return 'product conversation';
}

module.exports = { handleHumanProductConversation };
