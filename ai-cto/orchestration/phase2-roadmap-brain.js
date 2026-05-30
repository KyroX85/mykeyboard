const ROADMAP = {
  activePhase: 'PHASE 2 PREPARATION - EXPLAIN WEDGE',
  foundationStatus: 'PROTECTED_ASSET',
  northStar: 'Help users understand before they type while protecting keyboard trust.',
  priorityOrder: [
    'Protect Phase 1 foundation',
    'Build Explain',
    'Build execution layer',
    'Build screenshot understanding',
    'Build draft/reply later'
  ],
  phase2Wedge: 'EXPLAIN',
  protectedFoundation: [
    'typing trust',
    'swipe trust',
    'prediction trust',
    'keyboard sizing',
    'layout rhythm',
    'latency',
    'keyboard stability',
    'emoji/symbol maturity'
  ],
  rejectByDefault: [
    'foundation churn without evidence',
    'prediction rewrites as differentiation',
    'swipe rewrites as differentiation',
    'theme expansion as differentiation',
    'autonomous sending',
    'screenshot retention forever',
    'agent theater without completed actions'
  ],
  successMetric: 'more completed understanding/actions, not more features'
};

function classifyRoadmapWork(input = '') {
  const text = String(input || '').toLowerCase();
  if (/\b(prediction|predictor|swipe|sizing|layout|latency|keyboardservice|typing trust|keyboard trust|emoji|symbol)\b/.test(text)) {
    return {
      classification: 'FOUNDATION',
      reason: 'Touches protected keyboard foundation; requires evidence and strong justification.'
    };
  }
  if (/\b(explain|understand|screenshot understanding|bill|notice|form|error|post|document)\b/.test(text)) {
    return {
      classification: 'EXECUTION',
      reason: 'Directly supports the Phase 2 Explain wedge.'
    };
  }
  if (/\b(glass handle|execution layer|action surface|liquid glass|pull down|confirm|cancel)\b/.test(text)) {
    return {
      classification: 'EXECUTION',
      reason: 'Builds the controlled action surface for Phase 2.'
    };
  }
  if (/\b(companion|memory relationship|personal assistant|emotional|friend)\b/.test(text)) {
    return {
      classification: 'COMPANION',
      reason: 'Potential future direction; should follow Explain reliability, not precede it.'
    };
  }
  if (/\b(experiment|prototype|sandbox|test)\b/.test(text)) {
    return {
      classification: 'EXPERIMENT',
      reason: 'May be safe if bounded, measured, and rollbackable.'
    };
  }
  if (/\b(theme|architecture|refactor|modern|framework|multi-agent|dashboard|personality)\b/.test(text)) {
    return {
      classification: 'BLOAT',
      reason: 'Likely complexity without direct Phase 2 leverage.'
    };
  }
  return {
    classification: 'EXPERIMENT',
    reason: 'Not clearly foundation or Explain; needs sharper user pain and leverage evidence.'
  };
}

function formatRoadmapBrief() {
  return [
    `Current Foundation Health: ${ROADMAP.foundationStatus}. Typing, swipe, prediction, sizing, layout, latency, and stability are guarded assets.`,
    `Phase 2 Opportunities: ${ROADMAP.priorityOrder.slice(1).join(' -> ')}.`,
    `Highest Leverage Differentiator: ${ROADMAP.phase2Wedge}. Aritenis helps users understand confusing content before typing.`,
    'Trust Risk: any feature that slows typing, reads context silently, stores screenshots forever, or sends automatically is rejected.',
    'Recommended Next Step: build Explain and screenshot understanding through the execution layer, outside the typing hot path.'
  ].join('\n');
}

module.exports = {
  ROADMAP,
  classifyRoadmapWork,
  formatRoadmapBrief
};
