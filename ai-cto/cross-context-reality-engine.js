const { unifyAuditContext } = require('./audit-context-unifier');

function resolveCrossContextReality(options = {}) {
  const unified = unifyAuditContext(options);
  return {
    productChat: unified.context,
    ctoChat: unified.context,
    governanceLayer: unified.context,
    operationalMemory: unified.context,
    datasets: unified.context,
    reports: unified.context,
    auditConfidence: unified.auditConfidence
  };
}

module.exports = { resolveCrossContextReality };
