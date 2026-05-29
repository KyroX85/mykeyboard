const { discoverPrivacySurfaces } = require('./canonical-privacy-registry');

function detectAuditBlindspots(options = {}) {
  const registry = discoverPrivacySurfaces(options);
  return {
    blindspots: registry.hidden.blindspots,
    auditConfidence: registry.auditConfidence
  };
}

module.exports = { detectAuditBlindspots };
