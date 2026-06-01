const MAX_OPPORTUNITY_COSTS = 40;

function shouldEvaluateOpportunityCost(initiative = '', context = {}) {
  const text = initiativeText(initiative, context).toLowerCase();
  if (!text.trim()) return false;
  if (/\b(hi|hello|thanks|ok bro|how are you|memory audit|status only)\b/.test(text)) return false;
  return /\b(initiative|decision|build|create|add|ship|implement|design|rewrite|feature|proposal|should we|what if|phase 2|explain|execution layer|screenshot|prediction|swipe|architecture|infrastructure|orchestration|governance|framework)\b/.test(text);
}

function evaluateOpportunityCost(initiative = '', context = {}) {
  const text = initiativeText(initiative, context).trim();
  const signals = extractSignals(text);
  const initiativeClass = classifyInitiative(signals);
  const notDoing = unique([
    ...classNotDoing(initiativeClass),
    'A different one-variable experiment with clearer before/after evidence.'
  ]);
  const delayedUserProblems = unique([
    ...classDelayedUserProblems(initiativeClass),
    'The next real user pain waits while this initiative consumes attention.'
  ]);
  const lostLeverage = unique([
    ...classLostLeverage(initiativeClass),
    'Founder time is spent on this path instead of validating the highest-leverage wedge.'
  ]);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    initiative: text.slice(0, 260),
    initiativeClass,
    notDoing,
    delayedUserProblems,
    lostLeverage,
    tradeoffSeverity: severityFor(initiativeClass),
    recommendation: recommendationFor(initiativeClass),
    confidence: confidenceFor(signals, initiativeClass)
  };
}

function updateOpportunityCostMemory(existing = {}, opportunityCost = null) {
  const model = normalizeOpportunityCostMemory(existing);
  if (!opportunityCost) return model;
  const recentOpportunityCosts = [
    opportunityCost,
    ...model.recentOpportunityCosts.filter((item) => item.initiative !== opportunityCost.initiative)
  ].slice(0, MAX_OPPORTUNITY_COSTS);
  return {
    version: '1.0',
    recentOpportunityCosts,
    classCounts: countByClass(recentOpportunityCosts),
    lastOpportunityCost: opportunityCost,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeOpportunityCostMemory(value = {}) {
  const recentOpportunityCosts = Array.isArray(value && value.recentOpportunityCosts)
    ? value.recentOpportunityCosts
    : [];
  return {
    version: '1.0',
    recentOpportunityCosts,
    classCounts: value && value.classCounts && typeof value.classCounts === 'object'
      ? value.classCounts
      : countByClass(recentOpportunityCosts),
    lastOpportunityCost: value && value.lastOpportunityCost ? value.lastOpportunityCost : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function initiativeText(initiative, context = {}) {
  return String(
    initiative ||
    context.initiative ||
    context.decision ||
    context.idea ||
    context.proposal ||
    context.founderMessage ||
    context.agentAnswer ||
    ''
  );
}

function extractSignals(text = '') {
  const lower = text.toLowerCase();
  return {
    explain: /\b(explain|understand|screenshot|bill|notice|form|document|error|message)\b/.test(lower),
    executionLayer: /\b(execution layer|glass handle|liquid glass|action surface|draft|reply|email|prepare message)\b/.test(lower),
    infrastructure: /\b(infrastructure|architecture|framework|orchestration|governance|report|memory layer|agent system|multi-agent|scalable|modern)\b/.test(lower),
    hotPath: /\b(rewrite|prediction|keyboardservice|hot path|autocorrect|swipe|typing|latency)\b/.test(lower),
    explicitInitiative: /\b(initiative|decision|build|create|ship|implement|design|rewrite|proposal|should we|what if)\b/.test(lower)
  };
}

function classifyInitiative(signals) {
  if (signals.hotPath) return 'HOT_PATH_KEYBOARD';
  if (signals.infrastructure) return 'INFRASTRUCTURE_HEAVY';
  if (signals.explain || signals.executionLayer) return 'PHASE2_EXPLAIN';
  return 'GENERAL_PRODUCT_INITIATIVE';
}

function classNotDoing(initiativeClass) {
  if (initiativeClass === 'PHASE2_EXPLAIN') {
    return [
      'Draft and reply workflows that turn understanding into completed actions.',
      'Execution layer interaction design beyond the first Explain wedge.',
      'Foundation regression monitoring for typing, swipe, and keyboard trust.'
    ];
  }
  if (initiativeClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'Explain work that users can see inside confusing screenshots or messages.',
      'A user-facing product experiment that proves whether Aritenis creates leverage.',
      'Keyboard-to-action moments that make the product different from Gboard.'
    ];
  }
  if (initiativeClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Phase 2 Explain and execution-layer differentiation.',
      'Screenshot understanding experiments that answer why users would install Aritenis.',
      'Non-hot-path validation that protects the mature foundation.'
    ];
  }
  return [
    'The current highest-confidence Phase 2 Explain validation.',
    'A smaller product experiment with clearer user-visible value.'
  ];
}

function classDelayedUserProblems(initiativeClass) {
  if (initiativeClass === 'PHASE2_EXPLAIN') {
    return [
      'Users still cannot quickly draft replies or emails after they understand something.',
      'Typing, swipe, and foundation issues only get maintenance attention unless evidence becomes urgent.'
    ];
  }
  if (initiativeClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'Users still cannot understand confusing screenshots, bills, notices, forms, or messages faster.',
      'The product remains impressive internally but less useful in a real daily moment.'
    ];
  }
  if (initiativeClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Users still cannot understand confusing screenshots from the keyboard flow.',
      'The reason to choose Aritenis over mature keyboards gets delayed.'
    ];
  }
  return [
    'The user problem that most clearly supports repeat use may remain untested.'
  ];
}

function classLostLeverage(initiativeClass) {
  if (initiativeClass === 'PHASE2_EXPLAIN') {
    return [
      'If Explain is too narrow, Aritenis may miss the broader workflow completion leverage.',
      'Daily habit formation may be slower without draft, reply, or action completion loops.'
    ];
  }
  if (initiativeClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'User-visible leverage is lost while internal systems become more elaborate.',
      'The team may spend scarce attention proving the agents instead of proving the product.'
    ];
  }
  if (initiativeClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Phase 2 differentiation loses momentum while foundation work reopens.',
      'A protected asset consumes roadmap attention instead of creating new user leverage.'
    ];
  }
  return [
    'The initiative may consume time without clarifying why users would return.'
  ];
}

function severityFor(initiativeClass) {
  if (initiativeClass === 'INFRASTRUCTURE_HEAVY') return 'HIGH';
  if (initiativeClass === 'HOT_PATH_KEYBOARD') return 'HIGH';
  if (initiativeClass === 'PHASE2_EXPLAIN') return 'MEDIUM';
  return 'MEDIUM';
}

function recommendationFor(initiativeClass) {
  if (initiativeClass === 'PHASE2_EXPLAIN') {
    return 'Continue only if the Explain wedge stays user-visible, privacy-safe, and does not delay the broader action-surface path too long.';
  }
  if (initiativeClass === 'INFRASTRUCTURE_HEAVY') {
    return 'Do not prioritize until it directly unlocks a user-visible product moment or removes a concrete blocker.';
  }
  if (initiativeClass === 'HOT_PATH_KEYBOARD') {
    return 'Proceed only with evidence of foundation regression; otherwise protect Phase 1 and spend attention on Phase 2 leverage.';
  }
  return 'Compare against the active Explain wedge and choose the path with clearer user return behavior.';
}

function confidenceFor(signals, initiativeClass) {
  const signalCount = ['explain', 'executionLayer', 'infrastructure', 'hotPath', 'explicitInitiative']
    .filter((key) => signals[key]).length;
  const base = initiativeClass === 'GENERAL_PRODUCT_INITIATIVE' ? 54 : 65;
  return clamp(base + signalCount * 5, 50, 88);
}

function countByClass(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.initiativeClass ? item.initiativeClass : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldEvaluateOpportunityCost,
  evaluateOpportunityCost,
  updateOpportunityCostMemory,
  normalizeOpportunityCostMemory
};
