const {
  CANONICAL_AUTHORITIES,
  discoverPrivacySurfaces
} = require('./canonical-privacy-registry');

function resolveCanonicalDataflowAuthority(options = {}) {
  const registry = discoverPrivacySurfaces(options);
  return {
    authorities: CANONICAL_AUTHORITIES,
    surfaces: registry.surfaces,
    auditConfidence: registry.auditConfidence
  };
}

module.exports = { resolveCanonicalDataflowAuthority };
