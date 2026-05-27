function updateTasteMemory(state = {}, signal = {}) {
  const next = { ...state };
  next.annoyancePatterns = [...(next.annoyancePatterns || []), signal].slice(-300);
  return next;
}

function extractTasteGuidance(state = {}) {
  const patterns = state.annoyancePatterns || [];
  const unstable = patterns.filter((p) => p.confidenceImpact < 0).length;
  return {
    avoidAggressiveAutocorrect: unstable > 3,
    avoidLayoutChurn: patterns.some((p) => p.type === 'layout_instability'),
    keepInteractionCalm: true
  };
}

module.exports = { updateTasteMemory, extractTasteGuidance };

