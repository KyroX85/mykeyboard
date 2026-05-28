function reduceFounderInterruptions({ recommendations = [], maxDailyRecommendations = 1 } = {}) {
  const actionable = recommendations.filter((item) => item.action !== 'NO_ACTION_RECOMMENDED');
  if (actionable.length === 0) {
    const quiet = recommendations.find((item) => item.action === 'NO_ACTION_RECOMMENDED');
    return {
      messages: [quiet ? quiet.message : 'Founder, no action recommended today. Current stabilization trend is healthy.'],
      suppressedCount: 0
    };
  }
  const selected = actionable.slice(0, maxDailyRecommendations);
  return {
    messages: selected.map((item) => item.message),
    suppressedCount: Math.max(0, actionable.length - selected.length)
  };
}

module.exports = { reduceFounderInterruptions };
