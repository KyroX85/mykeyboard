const MAX_CRITIQUES = 50;

function shouldSelfCritiqueAnswer(answer = '', context = {}) {
  const text = answerText(answer, context).toLowerCase();
  if (!text.trim()) return false;
  if (/^(ok|yes|no|thanks|done)$/i.test(text.trim())) return false;
  if (isOperationalReadiness(text, context)) return false;
  return text.length >= 30 ||
    /\b(explain|daily habit|users|market|trust|evidence|phase 2|keyboard|prediction|infrastructure|orchestration|governance|strategy|dream)\b/.test(text);
}

function generateSelfCritique({ founderMessage = '', agentAnswer = '', context = {} } = {}) {
  const answer = String(agentAnswer || '').trim();
  const combined = `${founderMessage || ''} ${answer}`.toLowerCase();
  const signals = extractSignals(combined);
  const answerClass = classifyAnswer(signals);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    answerPreview: answer.slice(0, 260),
    answerClass,
    whyMightBeWrong: unique([
      ...classWrongness(answerClass),
      ...genericWrongness(signals)
    ]),
    assumptions: unique([
      ...classAssumptions(answerClass),
      ...genericAssumptions(signals)
    ]),
    missingEvidence: unique([
      ...classMissingEvidence(answerClass),
      ...genericMissingEvidence(signals)
    ]),
    confidence: confidenceFor(signals, answerClass, context)
  };
}

function updateSelfCritiqueMemory(existing = {}, critique = null) {
  const model = normalizeSelfCritiqueMemory(existing);
  if (!critique) return model;
  const recentCritiques = [
    critique,
    ...model.recentCritiques.filter((item) => item.answerPreview !== critique.answerPreview)
  ].slice(0, MAX_CRITIQUES);
  return {
    version: '1.0',
    recentCritiques,
    classCounts: countByClass(recentCritiques),
    lastCritique: critique,
    lastUpdatedAt: new Date().toISOString()
  };
}

function reviseAnswerWithSelfCritique({
  founderMessage = '',
  agentAnswer = '',
  critique = null
} = {}) {
  const answer = String(agentAnswer || '').trim();
  const activeCritique = critique || generateSelfCritique({ founderMessage, agentAnswer: answer });
  if (!answer || !activeCritique) return answer;

  const softened = softenUnsupportedCertainty(answer, activeCritique);
  const caveat = buildRevisionCaveat(activeCritique);
  if (!caveat || includesEquivalentCaveat(softened, caveat)) return softened;

  return [softened, caveat].filter(Boolean).join('\n');
}

function normalizeSelfCritiqueMemory(value = {}) {
  const recentCritiques = Array.isArray(value && value.recentCritiques) ? value.recentCritiques : [];
  return {
    version: '1.0',
    recentCritiques,
    classCounts: value && value.classCounts && typeof value.classCounts === 'object'
      ? value.classCounts
      : countByClass(recentCritiques),
    lastCritique: value && value.lastCritique ? value.lastCritique : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function answerText(answer, context = {}) {
  return String(
    answer ||
    context.agentAnswer ||
    context.response ||
    context.founderMessage ||
    ''
  );
}

function isOperationalReadiness(text = '', context = {}) {
  const route = context.route || {};
  const routeText = `${route.command || ''} ${route.matchedRoute || ''} ${route.intent || ''}`.toLowerCase();
  if (/\b(agent|team|status|health|momentum|cto_summary|weekly_summary)\b/.test(routeText)) return true;
  return /\bteam is ready\b/.test(text) &&
    /\bcoder:\s*ready\b/.test(text) &&
    /\breviewer:\s*standing by\b/.test(text);
}

function extractSignals(text = '') {
  return {
    phase2Explain: /\b(explain|understand|screenshot|bill|notice|form|document|confusing|daily habit)\b/.test(text),
    infrastructure: /\b(infrastructure|architecture|framework|orchestration|governance|report|agent system|multi-agent)\b/.test(text),
    hotPath: /\b(prediction|keyboardservice|hot path|typing|swipe|latency|autocorrect)\b/.test(text),
    strategic: /\b(strategy|dream|company|market|users|retention|leverage|vision)\b/.test(text),
    certainty: /\b(will|definitely|always|must|proven|clearly)\b/.test(text),
    evidenceClaim: /\b(evidence|verified|measured|tested|data|screenshot|retention)\b/.test(text)
  };
}

function classifyAnswer(signals) {
  if (signals.infrastructure) return 'INFRASTRUCTURE_OR_INTERNAL';
  if (signals.hotPath) return 'HOT_PATH_OR_FOUNDATION';
  if (signals.phase2Explain) return 'PHASE2_EXPLAIN';
  if (signals.strategic) return 'STRATEGIC_CLAIM';
  return 'GENERAL_ANSWER';
}

function classWrongness(answerClass) {
  if (answerClass === 'PHASE2_EXPLAIN') {
    return [
      'The answer may overestimate how often Explain becomes a daily habit.',
      'The answer may confuse founder excitement with real user demand.'
    ];
  }
  if (answerClass === 'INFRASTRUCTURE_OR_INTERNAL') {
    return [
      'The answer may treat internal infrastructure as user-visible progress.',
      'The answer may miss whether the work makes Aritenis more useful.'
    ];
  }
  if (answerClass === 'HOT_PATH_OR_FOUNDATION') {
    return [
      'The answer may understate risk to typing trust, latency, or prediction stability.',
      'The answer may assume local tests capture real keyboard feel.'
    ];
  }
  if (answerClass === 'STRATEGIC_CLAIM') {
    return [
      'The answer may be directionally plausible but too confident without market or user evidence.'
    ];
  }
  return ['The answer may be too generic or may not answer the founder objective deeply enough.'];
}

function genericWrongness(signals) {
  const items = [];
  if (signals.certainty && !signals.evidenceClaim) {
    items.push('The wording sounds more certain than the available evidence supports.');
  }
  return items;
}

function classAssumptions(answerClass) {
  if (answerClass === 'PHASE2_EXPLAIN') {
    return [
      'Users hate confusion enough to return to an in-keyboard Explain flow.',
      'The keyboard is a comfortable place to understand screenshots or documents.'
    ];
  }
  if (answerClass === 'INFRASTRUCTURE_OR_INTERNAL') {
    return [
      'Better internal systems will translate into user value.',
      'Founder will value operational maturity even when product leverage is not visible.'
    ];
  }
  if (answerClass === 'HOT_PATH_OR_FOUNDATION') {
    return [
      'The foundation can be changed without hurting typing trust.',
      'The benefit is worth reopening protected keyboard behavior.'
    ];
  }
  if (answerClass === 'STRATEGIC_CLAIM') {
    return [
      'The current strategic interpretation matches the founder dream and user reality.'
    ];
  }
  return ['The loaded memory and current message are enough to answer well.'];
}

function genericAssumptions(signals) {
  if (signals.evidenceClaim) return ['The cited evidence is fresh, relevant, and not just internal reasoning.'];
  return [];
}

function classMissingEvidence(answerClass) {
  if (answerClass === 'PHASE2_EXPLAIN') {
    return [
      'Repeat usage or retention evidence for Explain.',
      'Real frequency of confusing screenshots, bills, notices, forms, or messages.',
      'Proof that users prefer in-keyboard explanation over another AI app.'
    ];
  }
  if (answerClass === 'INFRASTRUCTURE_OR_INTERNAL') {
    return [
      'User-visible product leverage caused by the internal work.',
      'Founder-facing proof that this is not architecture theatre.'
    ];
  }
  if (answerClass === 'HOT_PATH_OR_FOUNDATION') {
    return [
      'Before/after typing trust, latency, correction, or swipe evidence.',
      'Rollback proof if keyboard feel regresses.'
    ];
  }
  if (answerClass === 'STRATEGIC_CLAIM') {
    return [
      'External user evidence, market response, or repeated founder validation.'
    ];
  }
  return [
    'Evidence that the answer actually satisfied the founder concern.'
  ];
}

function genericMissingEvidence(signals) {
  if (!signals.evidenceClaim) return ['Concrete evidence source for the main claim.'];
  return [];
}

function confidenceFor(signals, answerClass) {
  const signalCount = ['phase2Explain', 'infrastructure', 'hotPath', 'strategic', 'certainty', 'evidenceClaim']
    .filter((key) => signals[key]).length;
  const base = answerClass === 'GENERAL_ANSWER' ? 55 : 64;
  return clamp(base + signalCount * 4, 45, 88);
}

function softenUnsupportedCertainty(answer = '', critique = {}) {
  const hasWeakEvidence = Array.isArray(critique.missingEvidence) && critique.missingEvidence.length > 0;
  if (!hasWeakEvidence) return answer;
  return String(answer || '')
    .replace(/\bdefinitely\b/gi, 'could')
    .replace(/\balways\b/gi, 'often')
    .replace(/\bproven\b/gi, 'suggested')
    .replace(/\bclearly\b/gi, 'probably');
}

function buildRevisionCaveat(critique = {}) {
  const wrong = firstUseful(critique.whyMightBeWrong);
  const assumption = firstUseful(critique.assumptions);
  const missing = firstUseful(critique.missingEvidence);
  if (!wrong && !assumption && !missing) return '';

  if (critique.answerClass === 'PHASE2_EXPLAIN') {
    return `A smarter critic would say this is not proven yet: ${wrong || assumption}. Weak evidence: ${missing}.`;
  }
  if (critique.answerClass === 'INFRASTRUCTURE_OR_INTERNAL') {
    return `A smarter critic would ask whether this creates user-visible value. Weak evidence: ${missing || assumption || wrong}.`;
  }
  if (critique.answerClass === 'HOT_PATH_OR_FOUNDATION') {
    return `A smarter critic would worry about typing trust regression. Weak evidence: ${missing || assumption || wrong}.`;
  }
  return `This could be wrong because ${wrong || assumption}. Weak evidence: ${missing || 'the main claim is not externally proven yet'}.`;
}

function includesEquivalentCaveat(answer = '') {
  return /\b(could be wrong|weak evidence|not proven|smarter critic|assumption)\b/i.test(String(answer || ''));
}

function firstUseful(items = []) {
  return Array.isArray(items) ? items.find((item) => String(item || '').trim()) : null;
}

function countByClass(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.answerClass ? item.answerClass : 'UNKNOWN';
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
  shouldSelfCritiqueAnswer,
  generateSelfCritique,
  reviseAnswerWithSelfCritique,
  updateSelfCritiqueMemory,
  normalizeSelfCritiqueMemory
};
