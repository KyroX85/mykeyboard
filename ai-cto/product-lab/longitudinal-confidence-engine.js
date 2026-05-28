function estimateLongitudinalConfidence({
  evidenceDays = 0,
  repeatedFindings = 0,
  successfulValidations = 0,
  rollbackFreeDays = 0
} = {}) {
  const score = Math.min(100,
    Number(evidenceDays) * 6 +
    Number(repeatedFindings) * 12 +
    Number(successfulValidations) * 15 +
    Number(rollbackFreeDays) * 3
  );
  const notes = [];
  if (evidenceDays < 7) notes.push('no longitudinal evidence exists yet');
  if (successfulValidations <= 0) notes.push('no successful product validation yet');
  return {
    score,
    level: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
    notes
  };
}

module.exports = { estimateLongitudinalConfidence };
