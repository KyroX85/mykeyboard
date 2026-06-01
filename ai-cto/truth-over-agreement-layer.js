const MAX_TRUTH_CHECKS = 40;

function shouldEvaluateTruthOverAgreement(message = '', context = {}) {
  const text = messageText(message, context).toLowerCase();
  if (!text.trim()) return false;
  if (/\b(hi|hello|thanks|ok bro|how are you|memory audit|status only)\b/.test(text)) return false;
  return /\b(i think|i want|let us|should we|what if|agree|disagree|sounds impressive|users do not care|wrong thing|dream|build|rewrite|feature|proposal|decision|explain|execution layer|prediction|swipe|infrastructure|orchestration|governance|framework)\b/.test(text);
}

function evaluateTruthOverAgreement(message = '', context = {}) {
  const text = messageText(message, context).trim();
  const signals = extractSignals(text);
  const stance = stanceFor(signals);
  const disagreement = disagreementFor(stance, signals);
  const evidence = evidenceFor(stance, signals);
  const truthRisk = truthRiskFor(stance);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    message: text.slice(0, 260),
    stance,
    disagreement,
    evidence,
    truthRisk,
    recommendation: recommendationFor(stance),
    confidence: confidenceFor(signals, stance)
  };
}

function updateTruthOverAgreementMemory(existing = {}, truthCheck = null) {
  const model = normalizeTruthOverAgreementMemory(existing);
  if (!truthCheck) return model;
  const recentTruthChecks = [
    truthCheck,
    ...model.recentTruthChecks.filter((item) => item.message !== truthCheck.message)
  ].slice(0, MAX_TRUTH_CHECKS);
  return {
    version: '1.0',
    recentTruthChecks,
    stanceCounts: countByStance(recentTruthChecks),
    lastTruthCheck: truthCheck,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeTruthOverAgreementMemory(value = {}) {
  const recentTruthChecks = Array.isArray(value && value.recentTruthChecks) ? value.recentTruthChecks : [];
  return {
    version: '1.0',
    recentTruthChecks,
    stanceCounts: value && value.stanceCounts && typeof value.stanceCounts === 'object'
      ? value.stanceCounts
      : countByStance(recentTruthChecks),
    lastTruthCheck: value && value.lastTruthCheck ? value.lastTruthCheck : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function messageText(message, context = {}) {
  return String(
    message ||
    context.founderMessage ||
    context.idea ||
    context.proposal ||
    context.decision ||
    context.agentAnswer ||
    ''
  );
}

function extractSignals(text = '') {
  const lower = text.toLowerCase();
  return {
    userCareDoubt: /\b(users do not actually care|users do not care|users don't actually care|users don't care|nobody cares|not useful|who cares)\b/.test(lower),
    impressiveBias: /\b(sounds impressive|impressive|advanced|scalable|modern|sophisticated)\b/.test(lower),
    infrastructure: /\b(infrastructure|architecture|framework|orchestration|governance|report|memory layer|agent system|multi-agent)\b/.test(lower),
    hotPath: /\b(rewrite|prediction|keyboardservice|hot path|autocorrect|swipe|typing|latency)\b/.test(lower),
    noEvidence: /\b(without evidence|no evidence|just because|sounds)\b/.test(lower),
    explain: /\b(explain|understand|screenshot|bill|notice|form|document|error|message)\b/.test(lower),
    protectFoundation: /\b(protect phase 1|protect typing|protect swipe|foundation|trust|stability)\b/.test(lower),
    founderAssertion: /\b(i think|i want|let us|let's|should we|what if)\b/.test(lower)
  };
}

function stanceFor(signals) {
  if (signals.hotPath && (signals.noEvidence || signals.founderAssertion)) return 'DISAGREE_WITH_EXECUTION';
  if (signals.infrastructure && (signals.impressiveBias || !signals.explain)) return 'DISAGREE_WITH_DIRECTION';
  if (signals.userCareDoubt && signals.explain) return 'DISAGREE_WITH_ASSUMPTION';
  if (signals.explain && signals.protectFoundation && !signals.infrastructure && !signals.hotPath) return 'AGREE_WITH_EVIDENCE';
  if (signals.impressiveBias && !signals.explain) return 'DISAGREE_WITH_DIRECTION';
  return 'NEEDS_MORE_EVIDENCE';
}

function disagreementFor(stance, signals) {
  if (stance === 'DISAGREE_WITH_ASSUMPTION') {
    return [
      'I would not accept the assumption that users do not care without evidence.',
      'Confusing screenshots, bills, forms, notices, and messages are real user pain candidates; the truth question is frequency and workflow fit.'
    ];
  }
  if (stance === 'DISAGREE_WITH_DIRECTION') {
    return [
      'I would challenge this direction because user-visible usefulness is not proven.',
      'Infrastructure or impressive systems are not progress unless they make Aritenis more useful in a real moment.'
    ];
  }
  if (stance === 'DISAGREE_WITH_EXECUTION') {
    return [
      'I would disagree with executing this now because it risks the protected typing trust foundation.',
      'Hot-path keyboard work needs evidence, small scope, and rollback safety before agreement is justified.'
    ];
  }
  if (stance === 'AGREE_WITH_EVIDENCE') {
    return [
      'Agreement is justified only because the direction protects Phase 1 while testing a user-visible Phase 2 wedge.',
      'Even then, the test must prove real user value rather than founder excitement.'
    ];
  }
  return [
    'I would not agree yet because the claim lacks enough evidence.',
    'The next useful move is to separate belief, evidence, and user-facing consequence.'
  ];
}

function evidenceFor(stance, signals) {
  const evidence = [];
  if (signals.explain) evidence.push('Explain connects to confusing screenshots, documents, messages, and user pain candidates.');
  if (signals.infrastructure) evidence.push('Infrastructure language is present; users cannot feel this directly unless it unlocks a product moment.');
  if (signals.hotPath) evidence.push('Hot-path keyboard language is present; Phase 1 foundation risk is real.');
  if (signals.noEvidence) evidence.push('The message itself admits weak or missing evidence.');
  if (signals.protectFoundation) evidence.push('The direction explicitly protects typing trust, swipe trust, or stability.');
  if (!evidence.length) evidence.push('Evidence is insufficient; agreement would be premature.');
  if (stance === 'DISAGREE_WITH_ASSUMPTION') {
    evidence.push('Founder memory says the active wedge is understanding before typing, not generic infrastructure.');
  }
  return evidence;
}

function truthRiskFor(stance) {
  if (stance === 'AGREE_WITH_EVIDENCE') {
    return [
      'Agreement can still become false comfort if the test does not measure real user behavior.'
    ];
  }
  if (stance === 'NEEDS_MORE_EVIDENCE') {
    return [
      'The agent may sound helpful while avoiding the hard truth.',
      'Premature agreement would hide uncertainty.'
    ];
  }
  return [
    'Optimizing for founder approval would produce a false yes.',
    'Agreement without evidence would make the agent less intellectually useful.'
  ];
}

function recommendationFor(stance) {
  if (stance === 'DISAGREE_WITH_ASSUMPTION') {
    return 'Do not agree with the assumption yet; ask what evidence would prove users care or do not care.';
  }
  if (stance === 'DISAGREE_WITH_DIRECTION') {
    return 'Do not agree by default; challenge the direction until it becomes user-visible and useful.';
  }
  if (stance === 'DISAGREE_WITH_EXECUTION') {
    return 'Do not agree to execute; require evidence, minimal scope, and rollback safety first.';
  }
  if (stance === 'AGREE_WITH_EVIDENCE') {
    return 'Agree cautiously, keep evidence requirements explicit, and avoid turning agreement into permission for broad execution.';
  }
  return 'Stay uncertain, ask for evidence, and avoid pretending confidence.';
}

function confidenceFor(signals, stance) {
  const signalCount = ['userCareDoubt', 'impressiveBias', 'infrastructure', 'hotPath', 'noEvidence', 'explain', 'protectFoundation']
    .filter((key) => signals[key]).length;
  const base = stance === 'NEEDS_MORE_EVIDENCE' ? 55 : 66;
  return clamp(base + signalCount * 4, 50, 88);
}

function countByStance(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.stance ? item.stance : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldEvaluateTruthOverAgreement,
  evaluateTruthOverAgreement,
  updateTruthOverAgreementMemory,
  normalizeTruthOverAgreementMemory
};
