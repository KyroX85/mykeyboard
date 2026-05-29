const { discoverPrivacySurfaces } = require('./canonical-privacy-registry');

function detectHiddenDataflowRisks(options = {}) {
  return discoverPrivacySurfaces(options).hidden;
}

module.exports = { detectHiddenDataflowRisks };
