const PHASE1_TERMS = /(typing|trust|retention|swipe|symbol|spacing|sizing|adaptive|small(er)? phone|thumb|edge|dark mode|readability|responsiveness|visual comfort|keyboard height|layout)/i;
const DANGEROUS_TERMS = /(rewrite|modern scalable|multi-agent|deep learning|cloud|companion|self[- ]?evolving|architecture modernization)/i;

function reasonAboutRoadmapFit({ request = '', evidence = {}, files = [] } = {}) {
  const text = `${request} ${files.join(' ')} ${JSON.stringify(evidence.findings || [])}`;
  if (DANGEROUS_TERMS.test(text) && !PHASE1_TERMS.test(text)) {
    return {
      phase: 'PHASE_2_OR_LATER',
      aligned: false,
      decision: 'BLOCK_DANGEROUS',
      reason: 'Speculative or architecture-heavy request without direct typing trust evidence.'
    };
  }
  if (PHASE1_TERMS.test(text)) {
    return {
      phase: 'PHASE_1_TRUSTED_KEYBOARD',
      aligned: true,
      decision: 'ALLOW_SAFE_PHASE1',
      reason: 'Directly affects typing trust, thumb comfort, visual comfort, or retention.'
    };
  }
  return {
    phase: 'UNKNOWN',
    aligned: false,
    decision: 'DEFER_PHASE2',
    reason: 'No direct Phase 1 trust or retention evidence found.'
  };
}

module.exports = {
  reasonAboutRoadmapFit
};
