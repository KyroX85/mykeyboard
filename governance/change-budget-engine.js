function evaluateChangeBudget({ riskyEdits = 0, maxRiskyEdits = 2, cooldownActive = false, churnScore = 0 } = {}) {
  const blocked = cooldownActive || riskyEdits > maxRiskyEdits || churnScore >= 70;
  return {
    blocked,
    reason: cooldownActive ? 'cooldown_active' : riskyEdits > maxRiskyEdits ? 'risky_edit_limit_exceeded' : churnScore >= 70 ? 'churn_pressure_high' : null,
    mutationPressureScore: Math.min(100, riskyEdits * 20 + churnScore)
  };
}

module.exports = { evaluateChangeBudget };

