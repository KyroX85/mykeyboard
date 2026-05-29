const { discoverPrivacySurfaces } = require('./canonical-privacy-registry');

function unifyAuditContext(options = {}) {
  const registry = discoverPrivacySurfaces(options);
  return {
    context: 'CANONICAL_AI_CTO_PRIVACY_CONTEXT',
    source: 'repo-root-discovery',
    auditConfidence: registry.auditConfidence,
    surfaces: registry.surfaces,
    blindspots: registry.hidden.blindspots
  };
}

module.exports = { unifyAuditContext };
