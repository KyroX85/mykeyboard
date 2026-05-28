function classifyUxRisk({ evidence = {}, files = [], proposedChange = '' } = {}) {
  const protectedFileTouched = files.some((file) => /Keyboard(Service|SizingProfile|Symbols)|swipe|predictor|key_bg|keyboard_container/i.test(file));
  const highFinding = (evidence.findings || []).some((finding) => finding.severity === 'HIGH');
  const layoutOnly = /spacing|padding|sizing|symbol|layout|height|contrast|key/i.test(`${proposedChange} ${files.join(' ')}`);
  const rewrite = /\brewrite|redesign|architecture|framework|deep learning\b/i.test(proposedChange);

  if (rewrite) {
    return {
      risk: 'HIGH',
      blastRadius: 'UNBOUNDED',
      executionMode: 'BLOCK_DANGEROUS',
      requiresFounderApproval: true
    };
  }

  return {
    risk: highFinding ? 'MEDIUM' : 'LOW-MEDIUM',
    blastRadius: layoutOnly ? 'BOUNDED_LAYOUT' : protectedFileTouched ? 'PROTECTED_PRODUCT_SURFACE' : 'LOW',
    executionMode: layoutOnly ? 'SANDBOX_EXPERIMENT' : 'ASK_REVIEW',
    requiresFounderApproval: protectedFileTouched || highFinding,
    rollbackComplexity: layoutOnly ? 'LOW' : 'MEDIUM'
  };
}

module.exports = {
  classifyUxRisk
};
