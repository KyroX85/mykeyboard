function resolveCanonicalDataset() {
  return {
    authority: 'MyKeyboard/ai-cto/canonical-dataset-core.js',
    status: 'CONTRACT_ONLY_NO_DATASET_MOVE',
    rules: [
      'local-first',
      'privacy-safe',
      'auditable',
      'explicit retention rules required before persistence merge',
      'no raw typing leakage',
      'no hidden exports'
    ],
    forbiddenNow: ['moving SQLite', 'moving snapshots', 'deleting donor datasets', 'enabling hidden exports']
  };
}

module.exports = { resolveCanonicalDataset };
