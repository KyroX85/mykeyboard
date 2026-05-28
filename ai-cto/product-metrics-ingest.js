const {
  archiveProductEvidence
} = require('./product-governance');

const RAW_CONTENT_KEY_PATTERN = /(raw|text|word|words|phrase|sentence|conversation|keystroke|keyhistory|swipepath|path|input|message)/i;

function mapRuntimeMetricsToEvidence(payload = {}) {
  const rejectedKeys = [];
  for (const key of Object.keys(payload || {})) {
    if (RAW_CONTENT_KEY_PATTERN.test(key)) rejectedKeys.push(key);
  }

  const correctionBurstCount = bounded(payload.correctionBurstCount);
  const swipeFailureCount = bounded(payload.swipeFailureCount);
  const swipeRetryCount = bounded(payload.swipeRetryCount);
  const swipeAttempts = bounded(payload.swipeAttempts);
  const symbolModeToggleCount = bounded(payload.symbolModeToggleCount);
  const responsivenessSpikeCount = bounded(payload.responsivenessSpikeCount);
  const averageSwipeResolveLatencyMs = bounded(payload.averageSwipeResolveLatencyMs);
  const worstSwipeResolveLatencyMs = bounded(payload.worstSwipeResolveLatencyMs);
  const edgeKeyMissFrequency = bounded(payload.edgeKeyMissFrequency);

  const swipePain = swipeFailureCount + swipeRetryCount;
  const swipeStability = swipeAttempts > 0
    ? clamp(100 - Math.round((swipePain * 100) / swipeAttempts), 0, 100)
    : clamp(100 - swipePain * 10, 0, 100);
  const responsivenessPenalty = responsivenessSpikeCount * 10 +
    (averageSwipeResolveLatencyMs >= 48 ? 15 : 0) +
    (worstSwipeResolveLatencyMs >= 80 ? 15 : 0);

  return {
    evidence: {
      correctionLoad: correctionBurstCount,
      swipeStability,
      symbolFriction: symbolModeToggleCount,
      modeSwitchFriction: symbolModeToggleCount,
      responsiveness: clamp(100 - responsivenessPenalty, 0, 100),
      edgeKeyConfidence: clamp(100 - edgeKeyMissFrequency * 10, 0, 100)
    },
    rejectedKeys,
    privacySafe: rejectedKeys.length === 0
  };
}

function ingestAggregateMetrics({
  root = process.cwd(),
  payload = {},
  source = 'keyboard-runtime'
} = {}) {
  const mapped = mapRuntimeMetricsToEvidence(payload);
  const archive = archiveProductEvidence({
    root,
    snapshot: mapped.evidence,
    source
  });

  return {
    accepted: true,
    privacySafe: mapped.privacySafe,
    rejectedKeys: mapped.rejectedKeys,
    archive
  };
}

function createMetricsIngestHandler({ root = process.cwd() } = {}) {
  return (req, res) => {
    try {
      const result = ingestAggregateMetrics({
        root,
        payload: req.body || {},
        source: 'keyboard-runtime'
      });
      res.status(204).send();
      return result;
    } catch (error) {
      res.status(400).json({
        accepted: false,
        error: 'Invalid aggregate metrics payload'
      });
      return null;
    }
  };
}

function bounded(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(100000, Math.floor(number));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  createMetricsIngestHandler,
  ingestAggregateMetrics,
  mapRuntimeMetricsToEvidence
};
