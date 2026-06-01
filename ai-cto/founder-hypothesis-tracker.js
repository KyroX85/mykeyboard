const MAX_HYPOTHESES = 40;

function shouldTrackFounderHypothesis(text = '', context = {}) {
  const value = hypothesisText(text, context).toLowerCase();
  if (!value.trim()) return false;
  if (/\b(hi|hello|thanks|ok bro|how are you|memory audit|status only)\b/.test(value)) return false;
  return /\b(hypothesis|i believe|i think|assumption|bet|prove|unproven|daily habit|users hate confusion|keyboard is the best|distribution vehicle|explain will|users want|evidence)\b/.test(value);
}

function extractFounderHypothesis(details = {}) {
  const founderMessage = String(details.founderMessage || details.message || '');
  const agentAnswer = String(details.agentAnswer || '');
  const text = `${founderMessage} ${agentAnswer}`.trim();
  const signals = extractSignals(text);
  const hypothesisClass = classifyHypothesis(signals);
  const claim = claimFor(founderMessage, hypothesisClass);
  const status = statusFor(signals, hypothesisClass);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    claim,
    hypothesisClass,
    status,
    currentEvidence: currentEvidenceFor(signals, status),
    evidenceNeeded: evidenceNeededFor(hypothesisClass),
    risks: risksFor(hypothesisClass),
    confidence: confidenceFor(signals, status)
  };
}

function updateFounderHypothesisMemory(existing = {}, hypothesis = null) {
  const model = normalizeFounderHypothesisMemory(existing);
  if (!hypothesis) return model;
  const activeHypotheses = [
    hypothesis,
    ...model.activeHypotheses.filter((item) => hypothesisKey(item) !== hypothesisKey(hypothesis))
  ].slice(0, MAX_HYPOTHESES);
  return {
    version: '1.0',
    activeHypotheses,
    statusCounts: countByStatus(activeHypotheses),
    classCounts: countByClass(activeHypotheses),
    lastHypothesis: hypothesis,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeFounderHypothesisMemory(value = {}) {
  const activeHypotheses = Array.isArray(value && value.activeHypotheses) ? value.activeHypotheses : [];
  return {
    version: '1.0',
    activeHypotheses,
    statusCounts: value && value.statusCounts && typeof value.statusCounts === 'object'
      ? value.statusCounts
      : countByStatus(activeHypotheses),
    classCounts: value && value.classCounts && typeof value.classCounts === 'object'
      ? value.classCounts
      : countByClass(activeHypotheses),
    lastHypothesis: value && value.lastHypothesis ? value.lastHypothesis : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function hypothesisText(text, context = {}) {
  return String(
    text ||
    context.founderMessage ||
    context.agentAnswer ||
    context.idea ||
    context.proposal ||
    ''
  );
}

function extractSignals(text = '') {
  const lower = text.toLowerCase();
  return {
    explicitHypothesis: /\b(hypothesis|assumption|bet|i believe|i think)\b/.test(lower),
    explainDaily: /\b(explain will|explain.*daily|daily habit|daily use|repeat use|retention)\b/.test(lower),
    confusionPain: /\b(users hate confusion|hate confusion|confusing screenshots|bills|notices|forms|documents|errors|messages)\b/.test(lower),
    keyboardDistribution: /\b(keyboard is the best|distribution vehicle|keyboard.*distribution|keyboard.*personal intelligence|inside the keyboard)\b/.test(lower),
    evidenceWeak: /\b(unproven|not yet|insufficient|needs evidence|need evidence|needs real|before calling this proven|still unproven)\b/.test(lower),
    evidencePartial: /\b(plausible|partially|candidate|likely|some evidence|real frequency)\b/.test(lower),
    evidenceStrong: /\b(proven|validated|measured|repeat sessions|retention improved|daily usage)\b/.test(lower),
    contradicted: /\b(disproven|contradicted|users do not care|failed validation|no repeat use)\b/.test(lower)
  };
}

function classifyHypothesis(signals) {
  if (signals.keyboardDistribution) return 'KEYBOARD_DISTRIBUTION';
  if (signals.explainDaily) return 'EXPLAIN_DAILY_HABIT';
  if (signals.confusionPain) return 'USERS_HATE_CONFUSION';
  return 'GENERAL_FOUNDER_HYPOTHESIS';
}

function claimFor(founderMessage, hypothesisClass) {
  const explicit = String(founderMessage || '').match(/\b(?:hypothesis|assumption|bet)\s*:?\s*(.+?)(?:\.|$)/i);
  if (explicit) return cleanClaim(explicit[1]);
  if (hypothesisClass === 'EXPLAIN_DAILY_HABIT') return 'Explain will become a daily habit when users face confusing content.';
  if (hypothesisClass === 'USERS_HATE_CONFUSION') return 'Users hate confusion enough to want fast explanations in context.';
  if (hypothesisClass === 'KEYBOARD_DISTRIBUTION') return 'The keyboard is the best distribution vehicle for a personal intelligence layer.';
  return cleanClaim(founderMessage || 'Founder hypothesis needs clearer wording.');
}

function statusFor(signals, hypothesisClass) {
  if (signals.contradicted) return 'CONTRADICTED';
  if (signals.evidenceStrong && !signals.evidenceWeak) return 'SUPPORTED';
  if (signals.evidencePartial || hypothesisClass === 'USERS_HATE_CONFUSION') return 'PARTIALLY_SUPPORTED';
  return 'UNPROVEN';
}

function currentEvidenceFor(signals, status) {
  const evidence = [];
  if (status === 'SUPPORTED') evidence.push('Measured or validated evidence is referenced.');
  if (status === 'PARTIALLY_SUPPORTED') evidence.push('The claim is plausible, but frequency and retention evidence are incomplete.');
  if (status === 'UNPROVEN') evidence.push('Not yet proven; evidence is insufficient or explicitly missing.');
  if (status === 'CONTRADICTED') evidence.push('Contradicting evidence or failed validation is referenced.');
  if (signals.explainDaily) evidence.push('Explain and repeat-use language are present.');
  if (signals.confusionPain) evidence.push('Confusing screenshots, bills, notices, forms, documents, or messages are named as pain.');
  if (signals.keyboardDistribution) evidence.push('Keyboard distribution is named as a strategic vehicle, not yet proof.');
  return unique(evidence);
}

function evidenceNeededFor(hypothesisClass) {
  if (hypothesisClass === 'EXPLAIN_DAILY_HABIT') {
    return [
      'Repeated real or scripted sessions showing users return to Explain.',
      'Retention or usage evidence that Explain solves a frequent daily problem.',
      'Comparison against leaving the app to ask another AI tool.'
    ];
  }
  if (hypothesisClass === 'USERS_HATE_CONFUSION') {
    return [
      'Real frequency evidence for confusing screenshots, bills, notices, forms, documents, or messages.',
      'Evidence that users want explanations inside the keyboard flow.',
      'Proof that explanation reduces friction enough to create repeat use.'
    ];
  }
  if (hypothesisClass === 'KEYBOARD_DISTRIBUTION') {
    return [
      'Activation evidence that users will open the keyboard action surface at the right moment.',
      'Retention evidence showing keyboard distribution beats separate app behavior.',
      'Trust evidence that intelligence inside a keyboard does not feel invasive.'
    ];
  }
  return [
    'Clear user-facing behavior to observe.',
    'Before/after evidence tied to retention, trust, or repeat use.'
  ];
}

function risksFor(hypothesisClass) {
  if (hypothesisClass === 'EXPLAIN_DAILY_HABIT') {
    return [
      'Explain may be useful only occasionally, not daily.',
      'The feature may answer questions but not become a habit.'
    ];
  }
  if (hypothesisClass === 'USERS_HATE_CONFUSION') {
    return [
      'Users may tolerate confusion rather than install a new keyboard.',
      'Confusion may be real but not frequent enough to drive retention.'
    ];
  }
  if (hypothesisClass === 'KEYBOARD_DISTRIBUTION') {
    return [
      'Keyboard distribution may create activation friction or trust anxiety.',
      'Users may prefer a separate AI app for intelligence tasks.'
    ];
  }
  return [
    'The hypothesis may describe founder intuition rather than user behavior.'
  ];
}

function confidenceFor(signals, status) {
  const signalCount = ['explicitHypothesis', 'explainDaily', 'confusionPain', 'keyboardDistribution', 'evidenceWeak', 'evidencePartial', 'evidenceStrong', 'contradicted']
    .filter((key) => signals[key]).length;
  const base = status === 'SUPPORTED' ? 70 : status === 'PARTIALLY_SUPPORTED' ? 64 : 56;
  return clamp(base + signalCount * 3, 45, 88);
}

function countByStatus(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.status ? item.status : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function countByClass(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.hypothesisClass ? item.hypothesisClass : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function hypothesisKey(item = {}) {
  return `${item.hypothesisClass || 'UNKNOWN'}:${cleanClaim(item.claim || '')}`.toLowerCase();
}

function cleanClaim(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^that\s+/i, '')
    .trim()
    .slice(0, 220);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldTrackFounderHypothesis,
  extractFounderHypothesis,
  updateFounderHypothesisMemory,
  normalizeFounderHypothesisMemory
};
