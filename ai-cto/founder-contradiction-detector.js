const MAX_CONTRADICTIONS = 30;

function detectFounderContradiction({ founderMessage = '', memory = {}, details = {} } = {}) {
  const current = inferCurrentStatement(founderMessage);
  if (!current) return null;

  const tracker = memory.founderBeliefTracker || details.founderBeliefTracker || {};
  const pastBeliefs = Array.isArray(tracker.currentBeliefs) ? tracker.currentBeliefs : [];
  if (!pastBeliefs.length) return null;

  const explicitShift = isExplicitBeliefShift(founderMessage);
  const conflict = pastBeliefs
    .map((belief) => ({
      belief: String(belief.belief || ''),
      confidence: belief.confidence || null,
      score: contradictionScore(current, belief.belief)
    }))
    .filter((item) => item.score >= 0.62)
    .sort((a, b) => b.score - a.score)[0];

  if (!conflict) return null;

  const status = explicitShift ? 'BELIEF_CHANGED' : 'POSSIBLE_CONTRADICTION';
  return {
    timestamp: new Date().toISOString(),
    status,
    currentStatement: current.statement,
    pastBelief: conflict.belief,
    conflictType: current.axis,
    confidence: Math.min(90, Math.round(conflict.score * 100)),
    questionToAsk: status === 'BELIEF_CHANGED'
      ? 'Should I treat this as a belief shift and update the founder model?'
      : 'Has the founder changed your mind here, or is this a contradiction with the previous belief?',
    evidence: [
      `Current statement: ${current.statement}`,
      `Past belief: ${conflict.belief}`
    ]
  };
}

function updateFounderContradictions(existing = {}, contradiction = null) {
  const model = normalizeFounderContradictions(existing);
  if (!contradiction) return model;
  const items = [
    contradiction,
    ...model.items.filter((item) => contradictionKey(item) !== contradictionKey(contradiction))
  ].slice(0, MAX_CONTRADICTIONS);
  return {
    version: '1.0',
    items,
    unresolvedCount: items.filter((item) => item.status === 'POSSIBLE_CONTRADICTION').length,
    beliefChangedCount: items.filter((item) => item.status === 'BELIEF_CHANGED').length,
    lastContradiction: contradiction,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeFounderContradictions(value = {}) {
  return {
    version: '1.0',
    items: Array.isArray(value && value.items) ? value.items : [],
    unresolvedCount: Number.isFinite(value && value.unresolvedCount) ? value.unresolvedCount : 0,
    beliefChangedCount: Number.isFinite(value && value.beliefChangedCount) ? value.beliefChangedCount : 0,
    lastContradiction: value && value.lastContradiction ? value.lastContradiction : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function inferCurrentStatement(message = '') {
  const text = String(message || '');
  if (/but\s+now\s+agent\s+sophistication\s+matters\s+more/i.test(text)) {
    return {
      axis: 'agent_sophistication_vs_user_leverage',
      statement: 'agent sophistication matters more than user leverage',
      side: 'agent_sophistication'
    };
  }
  if (/agent\s+sophistication\s+matters\s+more\s+than\s+user\s+leverage/i.test(text)) {
    return {
      axis: 'agent_sophistication_vs_user_leverage',
      statement: 'agent sophistication matters more than user leverage',
      side: 'agent_sophistication'
    };
  }
  if (/user\s+leverage\s+(still\s+)?matters\s+more\s+than\s+agent\s+sophistication/i.test(text)) {
    return {
      axis: 'agent_sophistication_vs_user_leverage',
      statement: 'user leverage matters more than agent sophistication',
      side: 'user_leverage'
    };
  }
  if (/infrastructure\s+matters\s+more\s+than\s+the\s+product\s+wedge/i.test(text)) {
    return {
      axis: 'infrastructure_vs_product_wedge',
      statement: 'infrastructure matters more than the product wedge',
      side: 'infrastructure'
    };
  }
  if (/product\s+wedge\s+matters\s+more\s+than\s+infrastructure/i.test(text)) {
    return {
      axis: 'infrastructure_vs_product_wedge',
      statement: 'product wedge matters more than infrastructure',
      side: 'product_wedge'
    };
  }
  return null;
}

function contradictionScore(current = {}, pastBelief = '') {
  const past = String(pastBelief || '').toLowerCase();
  if (current.axis === 'agent_sophistication_vs_user_leverage') {
    if (current.side === 'agent_sophistication' &&
      /user leverage|repeatable usefulness|user value|users?.*care/.test(past) &&
      /agent sophistication|agent machinery|advanced agents/.test(past)) {
      return 0.88;
    }
    if (current.side === 'user_leverage' &&
      /agent sophistication matters more|agent machinery matters more/.test(past)) {
      return 0.82;
    }
  }
  if (current.axis === 'infrastructure_vs_product_wedge') {
    if (current.side === 'infrastructure' &&
      /product wedge|explain|user leverage|usefulness/.test(past)) {
      return 0.78;
    }
    if (current.side === 'product_wedge' &&
      /infrastructure matters more/.test(past)) {
      return 0.78;
    }
  }
  return 0;
}

function isExplicitBeliefShift(message = '') {
  return /\bused\s+to\s+think\b.*\bbut\s+now\b/i.test(String(message || '')) ||
    /\bbefore\b.*\b(now|after)\b/i.test(String(message || ''));
}

function contradictionKey(item = {}) {
  return `${item.status || 'UNKNOWN'}|${normalize(item.currentStatement)}|${normalize(item.pastBelief)}`;
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  detectFounderContradiction,
  updateFounderContradictions,
  normalizeFounderContradictions
};
