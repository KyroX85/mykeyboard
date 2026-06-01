const MAX_DISAGREEMENTS = 40;
const HIGH_CONFIDENCE_THRESHOLD = 75;

function generateStrongestDisagreement(message = '', memory = {}) {
  const text = String(message || '').trim();
  const signals = extractDisagreementSignals(text, memory);
  const kind = disagreementKind(signals);
  const confidence = confidenceFor(signals, kind);
  const shouldDisagree = confidence >= HIGH_CONFIDENCE_THRESHOLD && kind !== 'NO_STRONG_DISAGREEMENT';
  const evidence = evidenceFor(signals, memory);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    message: text.slice(0, 260),
    kind,
    shouldDisagree,
    disagreement: disagreementFor(kind),
    evidence,
    confidence,
    guardrail: shouldDisagree
      ? 'Disagree because evidence supports pushback, not because criticism is required.'
      : 'Do not force disagreement; evidence is too weak.'
  };
}

function applyIntelligentDisagreementToRoute(route = {}, {
  message = '',
  memory = {}
} = {}) {
  if (!route || typeof route.response !== 'string') return route;
  if (!isConversationRoute(route)) return route;
  const disagreement = generateStrongestDisagreement(message, memory);
  if (!disagreement.shouldDisagree) {
    return attachDisagreement(route, disagreement, false);
  }
  if (String(route.response || '').includes('Strongest disagreement:')) {
    return attachDisagreement(route, disagreement, false);
  }
  return attachDisagreement({
    ...route,
    response: [
      String(route.response || '').trim(),
      '',
      `Strongest disagreement: ${disagreement.disagreement}`,
      `Evidence: ${disagreement.evidence.slice(0, 2).join(' ')}`
    ].filter(Boolean).join('\n')
  }, disagreement, true);
}

function updateIntelligentDisagreementMemory(existing = {}, disagreement = null) {
  const memory = normalizeIntelligentDisagreementMemory(existing);
  if (!disagreement || !disagreement.shouldDisagree) return memory;
  const recentDisagreements = [
    disagreement,
    ...memory.recentDisagreements.filter((item) => item.message !== disagreement.message)
  ].slice(0, MAX_DISAGREEMENTS);
  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastDisagreement: disagreement,
    recentDisagreements,
    kindCounts: countByKind(recentDisagreements)
  };
}

function normalizeIntelligentDisagreementMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const recentDisagreements = Array.isArray(source.recentDisagreements)
    ? source.recentDisagreements.filter(Boolean).slice(0, MAX_DISAGREEMENTS)
    : [];
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastDisagreement: source.lastDisagreement || null,
    recentDisagreements,
    kindCounts: source.kindCounts && typeof source.kindCounts === 'object'
      ? source.kindCounts
      : countByKind(recentDisagreements)
  };
}

function extractDisagreementSignals(message = '', memory = {}) {
  const text = String(message || '').toLowerCase();
  const patternText = patternMemoryText(memory).toLowerCase();
  return {
    userCareClaim: /\busers?\b.*\b(do not|don't|dont|won't|will not|actually)\b.*\bcare\b|\bnobody cares\b/.test(text),
    explainMention: /\bexplain|screenshot|understand|confusing|bill|notice|form|document|message\b/.test(text),
    infrastructureBias: /\barchitecture|infrastructure|governance|orchestration|agent system|multi-agent|framework\b/.test(text),
    impressiveBias: /\bimpressive|advanced|scalable|sophisticated|modern\b/.test(text),
    hotPathRisk: /\brewrite|prediction|swipe|typing|keyboardservice|latency|hot path\b/.test(text),
    dreamConcern: /\bdream|vision|chasing|wrong thing|not satisfied\b/.test(text),
    patternSupportsUserValue: /\buser-facing leverage|users may not care|usefulness anxiety|prove Explain|daily|habit\b/.test(patternText),
    patternSupportsAgentConcern: /\btemplate|agent capability anxiety|status|generic\b/.test(patternText)
  };
}

function disagreementKind(signals = {}) {
  if (signals.hotPathRisk) return 'EXECUTION_RISK';
  if (signals.userCareClaim && (signals.explainMention || signals.patternSupportsUserValue)) return 'USER_VALUE_ASSUMPTION';
  if (signals.infrastructureBias || signals.impressiveBias) return 'INFRASTRUCTURE_BIAS';
  if (signals.dreamConcern && signals.patternSupportsAgentConcern) return 'DREAM_ALIGNMENT';
  return 'NO_STRONG_DISAGREEMENT';
}

function confidenceFor(signals = {}, kind = '') {
  if (kind === 'NO_STRONG_DISAGREEMENT') return 45;
  const signalCount = Object.values(signals).filter(Boolean).length;
  const base = kind === 'USER_VALUE_ASSUMPTION' ? 66 : 62;
  return Math.min(90, base + signalCount * 5);
}

function evidenceFor(signals = {}, memory = {}) {
  const evidence = [];
  if (signals.explainMention) evidence.push('Explain is tied to understanding confusing screenshots, documents, forms, notices, or messages.');
  if (signals.userCareClaim) evidence.push('The founder is making a broad user-care claim that needs proof before acceptance.');
  if (signals.infrastructureBias) evidence.push('Infrastructure language is present; users only care if it creates a felt product moment.');
  if (signals.impressiveBias) evidence.push('Impressive work can still fail if it is not useful.');
  if (signals.hotPathRisk) evidence.push('Hot-path keyboard changes can damage the protected Phase 1 foundation.');
  const patternEvidence = patternEvidenceFor(memory);
  if (patternEvidence) evidence.push(patternEvidence);
  if (!evidence.length) evidence.push('Evidence is too weak for a strong disagreement.');
  return evidence;
}

function disagreementFor(kind = '') {
  if (kind === 'USER_VALUE_ASSUMPTION') {
    return 'I would not agree that users do not care yet. The stronger truth is that users may not care about “AI,” but they do care about repeated confusing moments if Aritenis solves them faster inside the typing flow.';
  }
  if (kind === 'INFRASTRUCTURE_BIAS') {
    return 'I would push back on building more impressive infrastructure before proving a user-facing product moment. Sophistication is not leverage unless users feel it.';
  }
  if (kind === 'EXECUTION_RISK') {
    return 'I would disagree with executing this now because it risks the protected keyboard foundation. Strong product judgment means refusing hot-path changes until evidence and rollback safety are clear.';
  }
  if (kind === 'DREAM_ALIGNMENT') {
    return 'I would disagree with measuring progress by how mature the agent system looks. The dream only advances when a user-facing capability becomes more useful, trusted, or habitual.';
  }
  return 'No strong disagreement is justified from the available evidence.';
}

function isConversationRoute(route = {}) {
  const command = String(route.command || '');
  const details = route.details || {};
  if (/\b(build|scan|screenshot|execution|approval|commit|push|product_lab|preservation)\b/i.test(command)) return false;
  return Boolean(
    details.skipExecutionSchema ||
    command === 'founder_mind_reconstruction' ||
    command === 'conversational_fallback' ||
    command === 'agent'
  );
}

function attachDisagreement(route = {}, disagreement = {}, applied = false) {
  return {
    ...route,
    details: {
      ...(route.details || {}),
      intelligentDisagreement: {
        kind: disagreement.kind,
        confidence: disagreement.confidence,
        shouldDisagree: disagreement.shouldDisagree,
        applied,
        evidence: disagreement.evidence || []
      }
    }
  };
}

function patternMemoryText(memory = {}) {
  const report = memory.founderPatternDiscovery && memory.founderPatternDiscovery.lastReport;
  if (!report) return '';
  return [
    ...array(report.repeatedFears),
    ...array(report.repeatedFrustrations),
    ...array(report.repeatedGoals),
    ...array(report.repeatedQuestions),
    ...array(report.unnoticedPatterns)
  ].map((item) => `${item.pattern || ''} ${item.evidence || ''} ${item.implication || ''}`).join(' ');
}

function patternEvidenceFor(memory = {}) {
  const report = memory.founderPatternDiscovery && memory.founderPatternDiscovery.lastReport;
  if (!report) return null;
  const parts = [
    ...array(report.repeatedFears),
    ...array(report.repeatedGoals),
    ...array(report.unnoticedPatterns)
  ].slice(0, 2);
  if (!parts.length) return null;
  return `Founder pattern memory: ${parts.map((item) => item.pattern).join('; ')}.`;
}

function countByKind(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.kind ? item.kind : 'UNKNOWN';
    return {
      ...counts,
      [key]: (counts[key] || 0) + 1
    };
  }, {});
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  generateStrongestDisagreement,
  applyIntelligentDisagreementToRoute,
  updateIntelligentDisagreementMemory,
  normalizeIntelligentDisagreementMemory,
  HIGH_CONFIDENCE_THRESHOLD
};
