function buildApprovalPackage({
  proposedChange,
  evidenceSummary,
  retentionImpact,
  trustImpact,
  regressionRisk,
  runtimeImpact,
  saferThanDoingNothing = 'Evidence shows bounded product friction; implementation still waits for founder approval.'
} = {}) {
  return {
    requiresFounderApproval: true,
    mutationAllowedNow: false,
    proposedChange: clean(proposedChange),
    whatChanged: 'Nothing changed in product code. This is an approval package only.',
    whyItMatters: clean(evidenceSummary),
    retentionImpact: clean(retentionImpact),
    trustImpact: clean(trustImpact),
    regressionRisk: clean(regressionRisk || 'UNKNOWN'),
    runtimeImpact: clean(runtimeImpact || 'No runtime impact until approved.'),
    whySaferThanDoingNothing: clean(saferThanDoingNothing),
    blockedUntil: 'explicit founder approval'
  };
}

function isImplementationAllowed(approvalPackage, { founderApproved = false } = {}) {
  return Boolean(approvalPackage && approvalPackage.requiresFounderApproval && founderApproved);
}

function formatApprovalPackage(pkg = {}) {
  return [
    '# APPROVAL_GATE_PACKAGE',
    '',
    `- WHAT CHANGED: ${pkg.whatChanged || 'Nothing changed in product code.'}`,
    `- WHY IT MATTERS: ${pkg.whyItMatters || 'No evidence summary supplied.'}`,
    `- RETENTION IMPACT: ${pkg.retentionImpact || 'Unknown.'}`,
    `- TRUST IMPACT: ${pkg.trustImpact || 'Unknown.'}`,
    `- REGRESSION RISK: ${pkg.regressionRisk || 'UNKNOWN'}`,
    `- RUNTIME IMPACT: ${pkg.runtimeImpact || 'No runtime impact until approved.'}`,
    `- WHY THIS IS SAFER THAN DOING NOTHING: ${pkg.whySaferThanDoingNothing || 'Not established.'}`,
    '',
    'Status: AWAITING FOUNDER APPROVAL',
    ''
  ].join('\n');
}

function clean(value) {
  return String(value || '')
    .replace(/\b(password|private|personal|raw text|sentence|keystroke history)\b/gi, '[redacted]')
    .slice(0, 500);
}

module.exports = {
  buildApprovalPackage,
  formatApprovalPackage,
  isImplementationAllowed
};
