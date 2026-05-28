function estimateRegressionFear({
  protectedFiles = [],
  filesTouched = 0,
  linesChanged = 0,
  rollbackComplexity = 'MEDIUM',
  hotPathRuntime = false
} = {}) {
  let score = 0;
  if (protectedFiles.length) score += 18;
  score += Math.min(30, Number(filesTouched || 0) * 6);
  score += Math.min(35, Math.ceil(Number(linesChanged || 0) / 10) * 4);
  if (/HIGH/i.test(rollbackComplexity)) score += 25;
  if (/LOW/i.test(rollbackComplexity)) score -= 8;
  if (hotPathRuntime) score += 30;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    level: score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : score >= 15 ? 'LOW-MEDIUM' : 'LOW',
    reasons: reasons({ protectedFiles, filesTouched, linesChanged, rollbackComplexity, hotPathRuntime })
  };
}

function reasons(input) {
  const out = [];
  if (input.protectedFiles.length) out.push('protected product surface');
  if (input.filesTouched > 2) out.push('wide file surface');
  if (input.linesChanged > 50) out.push('large patch');
  if (input.hotPathRuntime) out.push('runtime hot path');
  if (/LOW/i.test(input.rollbackComplexity)) out.push('rollback is simple');
  return out;
}

module.exports = { estimateRegressionFear };
