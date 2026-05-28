const EXECUTION_WORDS = /\b(FIX|EXECUTE|IMPLEMENT|CREATE PATCH|APPLY CHANGE|COMMIT|MODIFY FILE|GENERATE REPORT|START TASK|BUILD|RUN PRODUCT LAB)\b/i;

function executionActivationDecision(message = '') {
  const text = String(message || '');
  const matched = text.match(EXECUTION_WORDS);
  return {
    executionRequested: Boolean(matched),
    activationWord: matched ? matched[0].toUpperCase() : '',
    reportRequested: /\bGENERATE REPORT\b/i.test(text),
    reason: matched
      ? 'explicit execution activation language found'
      : 'no explicit execution activation language found'
  };
}

module.exports = { executionActivationDecision };
