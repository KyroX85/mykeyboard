const VANITY_PATTERNS = [
  /rewrite with deep learning/i,
  /modern scalable architecture/i,
  /self evolving system/i,
  /multi-agent intelligence expansion/i,
  /future-proof rewrite/i
];

function evaluateVanity(proposal = '', evidenceScore = 0) {
  const matched = VANITY_PATTERNS.find((r) => r.test(String(proposal || '')));
  if (!matched) return { blocked: false };
  return {
    blocked: evidenceScore < 70,
    reason: evidenceScore < 70 ? 'retention_evidence_insufficient' : null
  };
}

module.exports = { evaluateVanity };

