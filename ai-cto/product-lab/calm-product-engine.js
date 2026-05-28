function enforceCalmProductExecution({
  proposedChange = '',
  filesTouched = 0,
  linesChanged = 0,
  rewritePressure = false,
  productBenefit = '',
  evidenceBacked = false
} = {}) {
  const rejections = [];
  if (rewritePressure || /\brewrite|redesign|modernize architecture|framework churn\b/i.test(proposedChange)) {
    rejections.push('rewrite pressure');
  }
  if (Number(filesTouched) > 2) rejections.push('too many files');
  if (Number(linesChanged) > 40) rejections.push('too many lines');
  if (!evidenceBacked) rejections.push('not evidence backed');
  if (!/(trust|calm|thumb|symbol|swipe|typing|retention|comfort|fatigue|readability)/i.test(productBenefit)) {
    rejections.push('weak product feel benefit');
  }
  return {
    allowed: rejections.length === 0,
    rejections,
    minimumNecessaryChange: `${filesTouched || 0} file(s), ${linesChanged || 0} line(s), one product variable only`,
    style: 'boring, small, reversible'
  };
}

module.exports = { enforceCalmProductExecution };
