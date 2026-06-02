const MAX_EVOLVED_BELIEFS = 30;

function recordBeliefEvolution(existing = {}, input = {}) {
  const memory = normalizeBeliefEvolution(existing);
  const evolution = normalizeEvolution(input);
  if (!evolution) return memory;
  const key = evolutionKey(evolution);
  return {
    version: '1.0',
    evolvedBeliefs: [
      evolution,
      ...memory.evolvedBeliefs.filter((item) => evolutionKey(item) !== key)
    ].slice(0, MAX_EVOLVED_BELIEFS),
    lastEvolution: evolution,
    lastUpdatedAt: new Date().toISOString()
  };
}

function recordBeliefEvolutionFromTracker(existing = {}, tracker = {}) {
  const shifts = [
    tracker && tracker.lastShift,
    ...(Array.isArray(tracker && tracker.beliefShifts) ? tracker.beliefShifts : [])
  ].filter(Boolean);
  return shifts.reduce((memory, shift) => recordBeliefEvolution(memory, {
    previousBelief: shift.beforeBelief,
    currentBelief: shift.afterBelief,
    evidence: [
      shift.changeReason,
      shift.assumption,
      shift.source
    ].filter(Boolean),
    strategicConsequences: inferConsequences(shift),
    tags: inferTags(`${shift.beforeBelief || ''} ${shift.afterBelief || ''} ${shift.changeReason || ''}`),
    confidence: shift.confidence,
    source: shift.source || 'founder_belief_tracker'
  }), existing);
}

function retrieveEvolvedBelief(question = '', memory = {}) {
  const normalized = normalizeBeliefEvolution(memory);
  const queryTokens = tokenize(question);
  const scored = normalized.evolvedBeliefs
    .map((belief) => ({
      ...belief,
      score: scoreEvolution(belief, queryTokens)
    }))
    .filter((belief) => belief.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0));
  const best = scored[0];
  if (!best) {
    return {
      matched: false,
      confidence: 30,
      reason: 'No evolved belief matched the question.'
    };
  }
  return {
    matched: true,
    previousBelief: best.previousBelief,
    currentBelief: best.currentBelief,
    evidence: best.evidence,
    strategicConsequences: best.strategicConsequences,
    confidence: Math.min(90, Math.max(40, (best.confidence || 62) + Math.min(12, best.score * 2))),
    source: best.source,
    reason: 'Question touched a known evolved founder belief.'
  };
}

function formatEvolvedBeliefForResponse(retrieval = {}) {
  if (!retrieval || !retrieval.matched) return '';
  return [
    'Evolved belief:',
    `- Previous: ${retrieval.previousBelief || 'unknown'}`,
    `- Current: ${retrieval.currentBelief || 'unknown'}`,
    `- Why it changed: ${first(retrieval.evidence) || 'evidence not recorded'}`,
    `- Strategic consequence: ${first(retrieval.strategicConsequences) || 'consequence not recorded'}`
  ].join('\n');
}

function normalizeBeliefEvolution(value = {}) {
  return {
    version: '1.0',
    evolvedBeliefs: Array.isArray(value && value.evolvedBeliefs) ? value.evolvedBeliefs : [],
    lastEvolution: value && value.lastEvolution ? value.lastEvolution : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function normalizeEvolution(input = {}) {
  const previousBelief = clean(input.previousBelief);
  const currentBelief = clean(input.currentBelief);
  if (!previousBelief || !currentBelief) return null;
  const body = `${previousBelief} ${currentBelief} ${array(input.evidence).join(' ')} ${array(input.strategicConsequences).join(' ')}`;
  return {
    timestamp: new Date().toISOString(),
    previousBelief,
    currentBelief,
    evidence: array(input.evidence).map(clean).filter(Boolean).slice(0, 5),
    strategicConsequences: array(input.strategicConsequences).map(clean).filter(Boolean).slice(0, 5),
    tags: [...new Set([...array(input.tags), ...inferTags(body)])].map(clean).filter(Boolean).slice(0, 10),
    source: input.source || 'belief_evolution_engine',
    confidence: Math.min(90, Math.max(0, input.confidence || 70))
  };
}

function inferConsequences(shift = {}) {
  const text = `${shift.beforeBelief || ''} ${shift.afterBelief || ''} ${shift.changeReason || ''}`.toLowerCase();
  if (/user|leverage|useful|value|habit|repeatable/.test(text)) {
    return [
      'Infrastructure progress is not company progress.',
      'Every feature must prove repeated user pull.'
    ];
  }
  if (/dream|vision|aligned/.test(text)) {
    return [
      'Work that does not move the dream toward user proof should be deprioritized.',
      'Vision alignment must be tested through user behavior, not internal conviction.'
    ];
  }
  return [
    'Newest founder belief should override older isolated lessons when answering related questions.'
  ];
}

function inferTags(text = '') {
  const tags = [];
  const value = String(text || '').toLowerCase();
  if (/agent|intelligence|smart/.test(value)) tags.push('agents');
  if (/user|leverage|useful|value/.test(value)) tags.push('user leverage');
  if (/infrastructure|architecture|system/.test(value)) tags.push('infrastructure');
  if (/company|progress|valuable/.test(value)) tags.push('company progress');
  if (/dream|vision/.test(value)) tags.push('dream');
  if (/explain|screenshot/.test(value)) tags.push('explain');
  return tags;
}

function scoreEvolution(evolution = {}, queryTokens = []) {
  const bodyTokens = tokenize([
    evolution.previousBelief,
    evolution.currentBelief,
    ...(evolution.evidence || []),
    ...(evolution.strategicConsequences || []),
    ...(evolution.tags || [])
  ].join(' '));
  let score = 0;
  for (const token of queryTokens) {
    if (bodyTokens.includes(token)) score += 3;
    if (bodyTokens.some((body) => body.includes(token) || token.includes(body))) score += 1;
  }
  if (/\bagents?\b|\bsmarter\b|\bvaluable\b|\bcompany\b/.test(queryTokens.join(' ')) &&
    /agents|user leverage|company progress/.test(bodyTokens.join(' '))) {
    score += 4;
  }
  return score;
}

function tokenize(value = '') {
  return clean(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !['what', 'why', 'how', 'the', 'this', 'that', 'are', 'was', 'were', 'about', 'with', 'does', 'make'].includes(token));
}

function evolutionKey(evolution = {}) {
  return `${clean(evolution.previousBelief).toLowerCase()}->${clean(evolution.currentBelief).toLowerCase()}`;
}

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function first(items = []) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

module.exports = {
  recordBeliefEvolution,
  recordBeliefEvolutionFromTracker,
  retrieveEvolvedBelief,
  formatEvolvedBeliefForResponse,
  normalizeBeliefEvolution
};
