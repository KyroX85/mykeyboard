const PRODUCT_PRIORITY = [
  'typing confidence',
  'swipe reliability',
  'responsiveness',
  'touch accuracy',
  'runtime stability',
  'memory efficiency',
  'maintainability',
  'cosmetic cleanup'
];

const CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildSemanticFounderState({ agent, intent, topic, state = {}, priorMemory = {} }) {
  const sections = state.sections || {};
  const continuity = priorMemory.currentContinuity || {};
  const stabilizedPrior = stabilizeSemanticMemory(priorMemory);
  const latestUnresolved =
    first(sections.unresolved) ||
    first(sections.risks) ||
    stabilizedPrior.latestUnresolvedIssue ||
    stabilizedPrior.unresolvedConcern ||
    null;
  const activeFocus = normalizeFocus(
    topic ||
    continuity.painPoint ||
    stabilizedPrior.activeFocus ||
    stabilizedPrior.lastFocusTopic ||
    stabilizedPrior.lastRequestedFocusArea ||
    inferProductFocus(latestUnresolved) ||
    null
  );
  const activeRuntimeProblem =
    runtimeProblemFrom(activeFocus) ||
    runtimeProblemFrom(latestUnresolved) ||
    stabilizedPrior.activeRuntimeProblem ||
    null;
  const requestedAction =
    continuity.requestedAction ||
    actionFromIntent(intent) ||
    stabilizedPrior.lastRequestedAction ||
    null;
  const semanticState = {
    founderGoal: compact(
      continuity.desiredOutcome ||
      stabilizedPrior.founderGoal ||
      stabilizedPrior.desiredOutcome ||
      'make the keyboard feel premium and stable'
    ),
    activeFocus: compact(activeFocus),
    currentFrustration: compact(continuity.frustration || activeRuntimeProblem || stabilizedPrior.currentFrustration),
    unresolvedReference: compact(
      activeFocus ||
      stabilizedPrior.unresolvedReference ||
      latestUnresolved
    ),
    repeatedPainPoints: mergeBounded(
      stabilizedPrior.repeatedPainPoints,
      continuity.painPoint || activeRuntimeProblem || inferProductFocus(latestUnresolved)
    ),
    desiredOutcome: compact(
      continuity.desiredOutcome ||
      stabilizedPrior.desiredOutcome ||
      stabilizedPrior.founderGoal ||
      'make the keyboard feel premium and stable'
    ),
    lastRequestedAction: compact(requestedAction),
    activeRuntimeProblem: compact(activeRuntimeProblem),
    blockedPriority: compact(
      latestUnresolved ||
      first(sections.repeatedFailures) ||
      stabilizedPrior.blockedPriority
    ),
    preferredResponseStyle: compact(
      continuity.preferredResponseStyle ||
      stabilizedPrior.preferredResponseStyle ||
      stabilizedPrior.founderPreferredWording ||
      'mobile-first short worker updates'
    ),
    lastAgentInteraction: agent || stabilizedPrior.lastAgentInteraction || null,
    lastIntent: intent || stabilizedPrior.lastIntent || null,
    lastUpdatedAt: new Date().toISOString()
  };
  const semanticConflicts = detectSemanticConflicts(semanticState);
  return {
    ...semanticState,
    unresolvedTopics: rankUnresolvedTopics(state, semanticState),
    semanticConflicts,
    contextConfidence: scoreContextConfidence({ ...semanticState, semanticConflicts })
  };
}

function resolveSemanticReference(message, semanticState = {}) {
  const normalized = String(message || '').toLowerCase();
  if (!/\b(this|that|them|it|continue|still broken|fixed ah|after that)\b/.test(normalized)) {
    return null;
  }
  return (
    semanticState.unresolvedReference ||
    semanticState.activeFocus ||
    semanticState.activeRuntimeProblem ||
    semanticState.blockedPriority ||
    null
  );
}

function rankProductPriorities(state = {}, semanticState = {}) {
  const evidenceText = [
    semanticState.activeFocus,
    semanticState.activeRuntimeProblem,
    semanticState.blockedPriority,
    semanticState.currentFrustration,
    ...array(state.sections && state.sections.risks),
    ...array(state.sections && state.sections.unresolved),
    ...array(state.sections && state.sections.nextPriority),
    ...array(state.sections && state.sections.repeatedFailures)
  ].filter(Boolean).join(' | ');

  return PRODUCT_PRIORITY.map((signal, index) => {
    const evidence = matchingEvidence(signal, evidenceText);
    return {
      signal,
      rank: evidence ? index + 1 : index + 20,
      evidence: evidence || 'not measured in latest state'
    };
  }).sort((a, b) => a.rank - b.rank);
}

function rankUnresolvedTopics(state = {}, semanticState = {}) {
  const sections = state.sections || {};
  const topics = new Map();
  const add = (topic, weight, evidence) => {
    if (!topic) return;
    const current = topics.get(topic) || { topic, weight: 0, evidence: [] };
    current.weight += weight;
    if (evidence) current.evidence = mergeBounded(current.evidence, compact(evidence, 90));
    topics.set(topic, current);
  };

  add(semanticState.activeRuntimeProblem, 40, semanticState.currentFrustration);
  add(semanticState.activeFocus, 30, semanticState.unresolvedReference);
  add(inferProductFocus(first(sections.unresolved)), 25, first(sections.unresolved));
  add(inferProductFocus(first(sections.risks)), 20, first(sections.risks));
  add(inferProductFocus(first(sections.repeatedFailures)), 15, first(sections.repeatedFailures));
  add('maintainability', 4, first(sections.completedFixes));

  return Array.from(topics.values()).sort((a, b) => b.weight - a.weight).slice(0, 5);
}

function continuationPlan(state = {}, semanticState = {}) {
  const priorities = rankProductPriorities(state, semanticState);
  const top = first(priorities);
  const focus = semanticState.activeFocus || (top && top.signal) || 'product stability';
  const safeOpportunity = first(state.sections && state.sections.safestOpportunity);
  const nextAction = safeOpportunity ||
    `Prepare a low-risk diagnostic proposal for ${focus}; no code push or destructive action.`;

  return {
    allowed: !detectSemanticConflicts(semanticState).includes('stale_context'),
    executionMode: 'analysis_and_proposal_only',
    focus,
    nextAction: compact(nextAction, 140),
    blockedBy: semanticState.blockedPriority || null,
    contextConfidence: semanticState.contextConfidence == null ? scoreContextConfidence(semanticState) : semanticState.contextConfidence
  };
}

function buildOperationalIntelligence(state = {}, semanticState = {}, memory = {}) {
  const strategicPriorities = strategicPriorityRanking(state, semanticState);
  const executionMemory = buildExecutionMemory(memory);
  const contradictionWarnings = detectOperationalContradictions(state, semanticState, executionMemory);
  const runtimeRealityRanking = rankRuntimeRealitySignals(state, semanticState);
  const productReasoning = buildProductReasoning(state, semanticState, runtimeRealityRanking);
  const pushback = buildFounderPushback(contradictionWarnings, productReasoning);

  return {
    strategicPriorities,
    executionMemory,
    contradictionWarnings,
    runtimeRealityRanking,
    productReasoning,
    pushback,
    nextSafeAction: pushback.required
      ? 'pause expansion; collect runtime evidence and propose a smaller product-facing validation step'
      : `continue analysis on ${strategicPriorities[0].signal}; no auto-push, workflow mutation, or dependency mutation`
  };
}

function strategicPriorityRanking(state = {}, semanticState = {}) {
  const evidence = evidenceText(state, semanticState);
  const weights = {
    'typing confidence': 100,
    'user trust': 95,
    'runtime stability': 90,
    'UX friction': 85,
    responsiveness: 80,
    'swipe reliability': 78,
    'touch accuracy': 74,
    'memory efficiency': 55,
    maintainability: 35,
    'cosmetic cleanup': 10,
    'report generation': 5,
    'architectural purity': 4
  };

  return Object.entries(weights).map(([signal, base]) => ({
    signal,
    score: base + signalEvidenceBoost(signal, evidence),
    evidence: signalEvidence(signal, evidence)
  })).sort((a, b) => b.score - a.score);
}

function buildExecutionMemory(memory = {}) {
  return {
    productFeelWins: boundedArray(memory.productFeelWins),
    regressionCauses: boundedArray(memory.regressionCauses),
    founderRejectedPatterns: boundedArray(memory.founderRejectedPatterns),
    frictionReducers: boundedArray(memory.frictionReducers),
    fakeProgressPatterns: boundedArray(memory.fakeProgressPatterns)
  };
}

function detectOperationalContradictions(state = {}, semanticState = {}, executionMemory = {}) {
  const text = evidenceText(state, semanticState);
  const warnings = [];
  if (/(new|proposed|add|expand|build|introduce).{0,40}(abstraction|architecture|system|framework|layer)/.test(text) && !/typing|swipe|latency|touch|device|ux|friction/.test(text)) {
    warnings.push('overengineering_without_product_signal');
  }
  if (/complexity|abstraction|architecture|system|layer/.test(text) && /no typing|without ux|without product|no runtime|not measured/.test(text)) {
    warnings.push('complexity_without_ux_improvement');
  }
  if (
    /report|documentation|summary|audit/.test(text) &&
    /(report-only|another architecture report|architecture report loop|cleanup loop|documentation loop|report loop|only maintenance)/.test(text)
  ) {
    warnings.push('fake_productivity_loop');
  }
  if (executionMemory.founderRejectedPatterns.some((item) => /report|complexity|abstraction/i.test(item))) {
    warnings.push('matches_founder_rejected_pattern');
  }
  return Array.from(new Set(warnings)).slice(0, 5);
}

function rankRuntimeRealitySignals(state = {}, semanticState = {}) {
  const text = evidenceText(state, semanticState);
  const signals = [
    ['real-device evidence', /real-device|device|screenshot|screen/i],
    ['typing friction', /typing|keypress|correction|backspace|symbol pain/i],
    ['swipe instability', /swipe|trail|gesture|long-word/i],
    ['responsiveness', /latency|responsive|slow|jank/i],
    ['visual hierarchy', /hierarchy|layout|spacing|symbol/i],
    ['theoretical cleanliness', /architecture|abstraction|cleanup|report|documentation/i]
  ];

  return signals.map(([signal, matcher], index) => ({
    signal,
    rank: matcher.test(text) ? index + 1 : index + 20,
    evidence: matcher.test(text) ? compact(text, 120) : 'not measured in latest state'
  })).sort((a, b) => a.rank - b.rank);
}

function buildProductReasoning(state = {}, semanticState = {}, runtimeRanking = []) {
  const topRuntime = first(runtimeRanking);
  return {
    operatorLens: 'keyboard product operator',
    strongestSignal: topRuntime ? topRuntime.signal : 'not measured',
    ergonomicsConcern: inferErgonomicsConcern(state, semanticState),
    trustConcern: inferTrustConcern(state, semanticState),
    transitionCostConcern: inferTransitionCostConcern(state, semanticState),
    measurableGap: hasMeasuredRuntimeEvidence(state, semanticState) ? null : 'runtime/product feel not fully verified yet'
  };
}

function buildFounderPushback(warnings = [], productReasoning = {}) {
  const required = warnings.some((warning) =>
    ['overengineering_without_product_signal', 'complexity_without_ux_improvement', 'fake_productivity_loop'].includes(warning)
  );
  return {
    required,
    message: required
      ? 'Founder, I should push back: this adds complexity without verified typing or UX improvement.'
      : 'No pushback needed from current grounded state.',
    reason: required ? warnings[0] : null,
    saferAlternative: required
      ? `prove ${productReasoning.strongestSignal || 'typing feel'} with runtime evidence before expanding systems`
      : 'continue current product-priority analysis'
  };
}

function stabilizeSemanticMemory(memory = {}) {
  const semantic = memory.semanticFounderState || {};
  const lastUpdatedAt = Date.parse(semantic.lastUpdatedAt || memory.lastUpdatedAt || '');
  const stale = Number.isFinite(lastUpdatedAt) && Date.now() - lastUpdatedAt > CONTEXT_TTL_MS;
  if (!stale) return { ...memory };
  return {
    ...memory,
    schoolMemoryStartedAt: memory.schoolMemoryStartedAt || memory.lastUpdatedAt || new Date().toISOString(),
    semanticConflicts: mergeBounded(memory.semanticConflicts, 'old_context_low_confidence'),
    contextConfidence: 0.45
  };
}

function detectSemanticConflicts(semanticState = {}) {
  const conflicts = [];
  const active = semanticState.activeFocus;
  const runtime = semanticState.activeRuntimeProblem;
  if (active && runtime && active !== runtime && isProductRuntimeFocus(runtime)) {
    conflicts.push('focus_conflicts_with_runtime_problem');
  }
  if (semanticState.unresolvedReference && active && semanticState.unresolvedReference !== active) {
    const unresolvedFocus = inferProductFocus(semanticState.unresolvedReference) || semanticState.unresolvedReference;
    if (unresolvedFocus !== active) conflicts.push('reference_conflicts_with_active_focus');
  }
  const lastUpdatedAt = Date.parse(semanticState.lastUpdatedAt || '');
  if (Number.isFinite(lastUpdatedAt) && Date.now() - lastUpdatedAt > CONTEXT_TTL_MS) {
    conflicts.push('stale_context');
  }
  return conflicts;
}

function scoreContextConfidence(semanticState = {}) {
  let score = 0.5;
  if (semanticState.activeFocus) score += 0.15;
  if (semanticState.unresolvedReference) score += 0.1;
  if (semanticState.blockedPriority) score += 0.1;
  if (semanticState.activeRuntimeProblem) score += 0.1;
  if (semanticState.lastRequestedAction) score += 0.05;
  const conflicts = semanticState.semanticConflicts || detectSemanticConflicts(semanticState);
  score -= conflicts.length * 0.18;
  if (conflicts.includes('stale_context')) score -= 0.2;
  return Math.max(0.1, Math.min(0.95, Number(score.toFixed(2))));
}

function inferProductFocus(text) {
  const raw = String(text || '').toLowerCase();
  if (/swipe|trail|gesture|long-word|long word/.test(raw)) return 'swipe reliability';
  if (/typing|keypress|correction|backspace|gboard/.test(raw)) return 'typing confidence';
  if (/latency|responsive|responsiveness|slow/.test(raw)) return 'responsiveness';
  if (/touch|thumb|tap/.test(raw)) return 'touch accuracy';
  if (/build|crash|stable|stability|lint|test/.test(raw)) return 'runtime stability';
  if (/memory|allocation|apk|startup/.test(raw)) return 'memory efficiency';
  if (/doc|report|cleanup|readme|policy/.test(raw)) return 'maintainability';
  return null;
}

function runtimeProblemFrom(value) {
  const inferred = inferProductFocus(value);
  if (!inferred) return null;
  return PRODUCT_PRIORITY.slice(0, 6).includes(inferred) ? inferred : null;
}

function normalizeFocus(value) {
  const inferred = inferProductFocus(value);
  return inferred || value;
}

function isProductRuntimeFocus(value) {
  return PRODUCT_PRIORITY.slice(0, 6).includes(value);
}

function matchingEvidence(signal, evidenceText) {
  const lower = String(evidenceText || '').toLowerCase();
  const matchers = {
    'typing confidence': /typing|keypress|correction|backspace|gboard/,
    'swipe reliability': /swipe|trail|gesture|long-word|long word/,
    responsiveness: /latency|responsive|responsiveness|slow/,
    'touch accuracy': /touch|thumb|tap/,
    'runtime stability': /build|crash|stable|stability|lint|test/,
    'memory efficiency': /memory|allocation|apk|startup/,
    maintainability: /cleanup|maintain|refactor|doc|report|readme|policy/,
    'cosmetic cleanup': /cosmetic|visual|style|formatting/
  };
  return matchers[signal] && matchers[signal].test(lower) ? compact(evidenceText, 120) : null;
}

function evidenceText(state = {}, semanticState = {}) {
  const sections = state.sections || {};
  const changed = state.changed || {};
  return [
    semanticState.activeFocus,
    semanticState.activeRuntimeProblem,
    semanticState.currentFrustration,
    semanticState.blockedPriority,
    semanticState.desiredOutcome,
    ...array(sections.risks),
    ...array(sections.unresolved),
    ...array(sections.repeatedFailures),
    ...array(sections.completedFixes),
    ...array(sections.nextPriority),
    ...array(sections.safestOpportunity),
    ...array(changed.completed),
    ...array(changed.newRisks),
    state.summary && state.summary.nextPriority,
    state.summary && state.summary.topRisk
  ].filter(Boolean).join(' | ').toLowerCase();
}

function signalEvidenceBoost(signal, text) {
  const matchers = {
    'typing confidence': /typing|keypress|correction|backspace|keyboard/,
    'user trust': /trust|confidence|reliable|premium/,
    'runtime stability': /build|crash|stable|stability|runtime|lint|test/,
    'UX friction': /friction|symbol pain|hierarchy|transition|ergonomic/,
    responsiveness: /latency|responsive|slow|jank/,
    'swipe reliability': /swipe|trail|gesture|long-word/,
    'touch accuracy': /touch|thumb|tap/,
    'memory efficiency': /memory|allocation|apk|startup/,
    maintainability: /maintain|cleanup|refactor/,
    'cosmetic cleanup': /cosmetic|visual|style/,
    'report generation': /report|summary|documentation/,
    'architectural purity': /architecture|abstraction|layer/
  };
  return matchers[signal] && matchers[signal].test(text) ? 12 : 0;
}

function signalEvidence(signal, text) {
  return signalEvidenceBoost(signal, text) > 0 ? compact(text, 110) : 'not measured in latest state';
}

function inferErgonomicsConcern(state, semanticState) {
  const text = evidenceText(state, semanticState);
  if (/symbol pain|symbol/.test(text)) return 'symbol access friction';
  if (/swipe|trail|gesture/.test(text)) return 'swipe rhythm trust';
  if (/typing|keypress/.test(text)) return 'typing rhythm confidence';
  return 'not fully verified yet';
}

function inferTrustConcern(state, semanticState) {
  const text = evidenceText(state, semanticState);
  if (/regression|unstable|weak|broken|clips|danger/.test(text)) return 'interaction confidence is not fully verified yet';
  return 'no explicit trust blocker recorded';
}

function inferTransitionCostConcern(state, semanticState) {
  const text = evidenceText(state, semanticState);
  if (/symbol|mode|switch|transition|hierarchy/.test(text)) return 'mode/symbol transition cost needs runtime evidence';
  return 'not measured in latest state';
}

function hasMeasuredRuntimeEvidence(state, semanticState) {
  return /real-device|screenshot|latency|keypress|correction|backspace|apk|memory|touch confidence/.test(
    evidenceText(state, semanticState)
  );
}

function boundedArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, 5) : [];
}

function actionFromIntent(intent) {
  if (intent === 'current_work') return 'check_progress';
  if (intent === 'risks') return 'check_risks';
  if (intent === 'priority') return 'prioritize';
  if (intent === 'validation') return 'validate';
  if (intent === 'summary') return 'summarize';
  return intent || null;
}

function mergeBounded(items, value) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!value) return list.slice(0, 5);
  return [value, ...list.filter((item) => item !== value)].slice(0, 5);
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value, max = 120) {
  if (!value) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  buildSemanticFounderState,
  resolveSemanticReference,
  rankProductPriorities,
  continuationPlan,
  inferProductFocus,
  rankUnresolvedTopics,
  detectSemanticConflicts,
  scoreContextConfidence,
  stabilizeSemanticMemory,
  buildOperationalIntelligence
};
