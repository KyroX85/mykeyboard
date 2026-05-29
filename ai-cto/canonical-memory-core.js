function resolveCanonicalMemory() {
  return {
    authority: 'MyKeyboard/ai-cto/canonical-memory-core.js',
    status: 'CONTRACT_ONLY_NO_STORE_MERGE',
    includes: ['operational memory', 'product memory', 'regression memory', 'rollback memory', 'founder preference memory'],
    forbiddenNow: ['merging JSON stores', 'deleting donor memory', 'making donor memory writable authority'],
    splitBrainProtection: 'memory authority is declared here; persistence convergence requires separate approval'
  };
}

module.exports = { resolveCanonicalMemory };
