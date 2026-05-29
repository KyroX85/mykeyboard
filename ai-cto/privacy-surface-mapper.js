const { mapPrivacySurface } = require('./canonical-privacy-registry');

function buildPrivacySurfaceMap(options = {}) {
  return mapPrivacySurface(options);
}

module.exports = { buildPrivacySurfaceMap };
