const MAX_CONTRADICTIONS = 40;

function detectContradiction({ founderMessage = '', memory = {}, details = {} } = {}) {
  const message = String(founderMessage || details.founderMessage || '').trim();
  if (!message) return null;
  return detectFounderStatementConflict(message, memory, details) ||
    detectStrategyGoalConflict(message, memory, details) ||
    detectProductDirectionVisionConflict(message, memory, details);
}

function updateContradictionMemory(existing = {}, contradiction = null) {
  const memory = normalizeContradictionMemory(existing);
  if (!contradiction) return memory;
  const items = [
    contradiction,
    ...memory.items.filter((item) => contradictionKey(item) !== contradictionKey(contradiction))
  ].slice(0, MAX_CONTRADICTIONS);
  return {
    version: '1.0',
    items,
    unresolvedCount: items.filter((item) => item.status === 'UNRESOLVED').length,
    lastContradiction: contradiction,
    lastUpdatedAt: new Date().toISOString()
  };
}

function formatContradictionForResponse(contradiction = {}) {
  if (!contradiction) return '';
  return [
    `Contradiction: ${contradiction.contradiction || 'unknown'}`,
    `Why it matters: ${contradiction.whyItMatters || 'unknown'}`,
    `Likely root cause: ${contradiction.likelyRootCause || 'unknown'}`
  ].join('\n');
}

function normalizeContradictionMemory(value = {}) {
  return {
    version: '1.0',
    items: Array.isArray(value && value.items) ? value.items : [],
    unresolvedCount: Number.isFinite(value && value.unresolvedCount) ? value.unresolvedCount : 0,
    lastContradiction: value && value.lastContradiction ? value.lastContradiction : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function detectFounderStatementConflict(message, memory = {}, details = {}) {
  const tracker = memory.founderBeliefTracker || details.founderBeliefTracker || {};
  const beliefs = Array.isArray(tracker.currentBeliefs) ? tracker.currentBeliefs : [];
  const text = normalize(message);
  const hasUserLeverageBelief = beliefs.some((item) =>
    /user leverage|repeatable usefulness|user value|users?.*care/.test(normalize(item.belief)) &&
    /agent sophistication|agent machinery|advanced agents/.test(normalize(item.belief))
  );
  if (hasUserLeverageBelief && /agent sophistication matters more|smarter agents matter more|advanced agents matter more/.test(text)) {
    return buildContradiction({
      type: 'FOUNDER_STATEMENT_CONFLICT',
      contradiction: 'Founder statement now favors agent sophistication over the stored belief that user leverage matters more than agent sophistication.',
      whyItMatters: 'If the system uses the wrong belief, it may optimize the founder model in the wrong direction and treat infrastructure as company progress.',
      likelyRootCause: 'Possible belief shift, stress-testing, or an older assumption resurfacing under pressure.',
      evidence: [
        `Current statement: ${message}`,
        'Stored belief: user leverage and repeatable usefulness matter more than agent sophistication'
      ],
      confidence: 86
    });
  }
  return null;
}

function detectStrategyGoalConflict(message, memory = {}, details = {}) {
  const text = normalize(message);
  const goals = [
    ...(Array.isArray(memory.founderGoals) ? memory.founderGoals : []),
    ...(Array.isArray(details.founderGoals) ? details.founderGoals : [])
  ];
  const hasExplainGoal = goals.some((goal) =>
    /explain|understand before typing|screenshot understanding|phase 2/.test(normalize(`${goal.objective || ''} ${goal.concern || ''} ${goal.actualQuestion || ''}`))
  );
  const asksToIgnoreExplain = /ignore explain|delay explain|skip explain/.test(text);
  const infrastructureMonth = /(month|weeks?|quarter).*(orchestration|infrastructure|agent plumbing)|(?:orchestration|infrastructure|agent plumbing).*(month|weeks?|quarter)/.test(text);
  if (hasExplainGoal && (asksToIgnoreExplain || infrastructureMonth)) {
    return buildContradiction({
      type: 'STRATEGY_GOAL_CONFLICT',
      contradiction: 'The proposed strategy prioritizes orchestration or infrastructure while the stored goal is to prove Explain as the active wedge.',
      whyItMatters: 'It delays the active wedge and weakens user proof while making internal progress look like company progress.',
      likelyRootCause: 'Infrastructure feels safer than facing killer feature uncertainty, so the system may drift away from the harder product proof.',
      evidence: [
        `Current statement: ${message}`,
        `Stored goal: ${first(goals).objective || first(goals).concern || 'Explain active wedge'}`
      ],
      confidence: 84
    });
  }
  return null;
}

function detectProductDirectionVisionConflict(message, memory = {}, details = {}) {
  const text = normalize(message);
  const vision = normalize(memory.founderVision || details.founderVision || [
    'Aritenis is a privacy-safe keyboard intelligence layer.',
    'The active differentiator is Explain and understanding before typing.'
  ].join(' '));
  const cloudChatbotDirection = /cloud ai chatbot|general ai chatbot|chatgpt clone|generic chatbot|cloud companion/.test(text);
  const keyboardExplainVision = /keyboard|privacy|explain|understand before typing|typing/.test(vision);
  if (cloudChatbotDirection && keyboardExplainVision) {
    return buildContradiction({
      type: 'PRODUCT_DIRECTION_VISION_CONFLICT',
      contradiction: 'The product direction shifts toward a general cloud AI chatbot while the founder vision is a privacy-safe keyboard Explain layer.',
      whyItMatters: 'It risks privacy trust, loses the keyboard distribution advantage, and moves away from the vision users would experience inside typing flow.',
      likelyRootCause: 'Category drift from competing with generic AI tools instead of proving the keyboard-native understanding wedge.',
      evidence: [
        `Current statement: ${message}`,
        `Founder vision: ${memory.founderVision || details.founderVision || 'privacy-safe keyboard Explain layer'}`
      ],
      confidence: 85
    });
  }
  return null;
}

function buildContradiction({
  type,
  contradiction,
  whyItMatters,
  likelyRootCause,
  evidence = [],
  confidence = 70
}) {
  return {
    timestamp: new Date().toISOString(),
    status: 'UNRESOLVED',
    type,
    contradiction,
    whyItMatters,
    likelyRootCause,
    evidence: evidence.filter(Boolean).slice(0, 5),
    confidence: Math.min(90, Math.max(0, confidence))
  };
}

function contradictionKey(item = {}) {
  return `${item.type || 'UNKNOWN'}|${normalize(item.contradiction)}|${normalize(first(item.evidence))}`;
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(items = []) {
  return Array.isArray(items) && items.length ? items[0] : {};
}

module.exports = {
  detectContradiction,
  updateContradictionMemory,
  formatContradictionForResponse,
  normalizeContradictionMemory
};
