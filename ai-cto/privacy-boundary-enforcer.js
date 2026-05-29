const { enforcePrivacyBoundary } = require('./canonical-privacy-registry');

function enforceCanonicalPrivacyBoundary(options = {}) {
  return enforcePrivacyBoundary(options);
}

module.exports = { enforceCanonicalPrivacyBoundary };
