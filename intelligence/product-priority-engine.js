const PRIORITY_BUCKETS = {
  CRITICAL: ['typing trust regression', 'swipe failure', 'latency instability', 'crash/stability risk', 'install/update failure'],
  HIGH: ['correction frustration', 'responsiveness degradation', 'dark-mode readability', 'symbol friction'],
  MEDIUM: ['ergonomic improvements', 'workflow continuity', 'bounded assistance'],
  LOW: ['architecture cleanup', 'AI sophistication', 'autonomous experimentation', 'cosmetic modernization'],
  VERY_LOW: ['speculative rewrites', 'future-proofing', 'vanity refactors']
};

function classifyProposalPriority(proposal = '') {
  const text = String(proposal || '').toLowerCase();
  for (const [bucket, keys] of Object.entries(PRIORITY_BUCKETS)) {
    if (keys.some((k) => text.includes(k.toLowerCase().split('/')[0]))) return bucket;
  }
  return 'MEDIUM';
}

module.exports = { PRIORITY_BUCKETS, classifyProposalPriority };

