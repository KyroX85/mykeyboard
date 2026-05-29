const { discoverPrivacySurfaces } = require('./canonical-privacy-registry');

function inspectDatasetVisibility(options = {}) {
  const registry = discoverPrivacySurfaces(options);
  return {
    datasets: registry.hidden.datasetLike,
    canonicalDatasetSurface: registry.surfaces.find((surface) => surface.id === 'ai-cto-datasets'),
    persists: registry.hidden.persistenceLike,
    exportable: registry.hidden.datasetLike.filter((file) => /export|sync|upload/i.test(file)),
    auditConfidence: registry.auditConfidence
  };
}

module.exports = { inspectDatasetVisibility };
