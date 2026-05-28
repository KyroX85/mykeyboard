const { selectOperationalMode } = require('./mode-selection-engine');

function routeGovernanceSeparation({ message = '', governanceMode = 'ACTIVE' } = {}) {
  const selection = selectOperationalMode(message);
  const isExecution = selection.mode === 'EXECUTION';
  const preservationBlocked = isExecution && governanceMode === 'PRESERVATION_ONLY';
  return {
    mode: selection.mode,
    reason: preservationBlocked
      ? 'PRESERVATION_ONLY blocks mutation before execution starts'
      : selection.reason,
    governanceRequired: isExecution,
    executionAllowed: isExecution ? !preservationBlocked : false,
    conversationAllowed: !isExecution
  };
}

module.exports = { routeGovernanceSeparation };
