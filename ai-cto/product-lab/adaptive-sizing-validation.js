function validateAdaptiveSizing({ widthBuckets = [], minKeyWidth = 40, minEdgePaddingDp = 4 } = {}) {
  const findings = [];
  for (const bucket of widthBuckets) {
    const keyTooSmall = Number(bucket.averageKeyWidth || 0) < minKeyWidth;
    const edgeTooTight = Number(bucket.edgePaddingDp || 0) < minEdgePaddingDp;
    if (!keyTooSmall && !edgeTooTight) continue;
    findings.push({
      bucket: bucket.name || `${bucket.widthPx || 'unknown'}px`,
      widthPx: Number(bucket.widthPx || 0),
      type: keyTooSmall ? 'small-key-target' : 'tight-edge-padding',
      measured: `averageKeyWidth=${bucket.averageKeyWidth || 0}px edgePadding=${bucket.edgePaddingDp || 0}dp`,
      message: 'Adaptive sizing is likely too tight for this width bucket.'
    });
  }
  return {
    status: findings.length ? 'ATTENTION_NEEDED' : 'PASS',
    findings,
    rollbackSafety: 'LOW_COMPLEXITY_IF_SINGLE_BUCKET_CHANGE'
  };
}

module.exports = {
  validateAdaptiveSizing
};
