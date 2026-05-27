function evaluateIterationSafety({ simultaneousMutations = 0, instability = 0, rewritePressure = 0, cooldown = false } = {}) {
  const churn = simultaneousMutations * 20 + instability + rewritePressure;
  return {
    blocked: cooldown || simultaneousMutations > 2 || churn >= 80,
    churnScore: Math.min(100, churn),
    mode: churn >= 80 ? 'SLOW_DOWN' : 'NORMAL_LOW_RISK'
  };
}

module.exports = { evaluateIterationSafety };

