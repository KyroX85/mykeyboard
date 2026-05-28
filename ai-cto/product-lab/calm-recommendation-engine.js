function buildCalmRecommendation({
  recurringFriction = {},
  trustErosion = {},
  stabilityTrend = {},
  confidence = 'LOW',
  proposedAction = '',
  regressionRisk = 'MEDIUM'
} = {}) {
  const hasPressure = (recurringFriction.highest?.count || 0) >= 2 || (trustErosion.score || 0) >= 40;
  if (!hasPressure || stabilityTrend.trend === 'HEALTHY') {
    return {
      action: 'NO_ACTION_RECOMMENDED',
      message: 'Founder, no action recommended today. Current stabilization trend is healthy.'
    };
  }
  const issue = recurringFriction.highest?.issue || 'Phase 1 friction';
  const cycles = recurringFriction.highest?.count || 0;
  return {
    action: 'ASK_APPROVAL_FOR_BOUNDED_EXPERIMENT',
    issue,
    message: [
      'Founder,',
      `Today\'s highest recurring pressure: ${issue}.`,
      `Evidence confidence: ${confidence}.`,
      `Observed in: ${cycles} screenshot cycles.`,
      `Trust impact: ${trustErosion.level || 'LOW'}.`,
      `Regression risk: ${regressionRisk}.`,
      `Safest improvement: ${proposedAction || 'bounded one-variable product experiment only'}.`,
      '',
      'No other action recommended today.',
      'Proceed?'
    ].join('\n')
  };
}

module.exports = { buildCalmRecommendation };
