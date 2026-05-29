const { discoverPrivacySurfaces } = require('./canonical-privacy-registry');

function detectOrphanTelemetry(options = {}) {
  return discoverPrivacySurfaces(options).hidden.orphanTelemetry;
}

module.exports = { detectOrphanTelemetry };
