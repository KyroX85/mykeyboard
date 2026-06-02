const MAX_ITEMS = 40;

function updateStrategicMemory(existing = {}, input = {}) {
  const memory = normalizeStrategicMemory(existing);
  const conclusions = extractStrategicConclusions(input);
  return {
    version: '1.0',
    lessonsLearned: mergeItems(memory.lessonsLearned, conclusions.lessonsLearned),
    failedHypotheses: mergeItems(memory.failedHypotheses, conclusions.failedHypotheses),
    successfulHypotheses: mergeItems(memory.successfulHypotheses, conclusions.successfulHypotheses),
    founderBeliefChanges: mergeItems(memory.founderBeliefChanges, conclusions.founderBeliefChanges),
    lastUpdatedAt: new Date().toISOString()
  };
}

function retrieveRelevantStrategicMemory(question = '', strategicMemory = {}, { limit = 4 } = {}) {
  const normalized = normalizeStrategicMemory(strategicMemory);
  const query = tokenize(question);
  const all = [
    ...tagItems('lesson', normalized.lessonsLearned),
    ...tagItems('failed_hypothesis', normalized.failedHypotheses),
    ...tagItems('successful_hypothesis', normalized.successfulHypotheses),
    ...tagItems('belief_change', normalized.founderBeliefChanges)
  ];

  const scored = all
    .map((item) => ({
      ...item,
      score: scoreItem(item, query)
    }))
    .filter((item) => item.score > 0 || query.length === 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0))
    .slice(0, Math.max(1, limit));

  return {
    version: '1.0',
    query: String(question || '').slice(0, 240),
    items: scored,
    confidence: scored.length ? Math.min(88, 58 + scored.length * 7) : 35
  };
}

function formatStrategicMemoryForResponse(retrieval = {}) {
  const items = Array.isArray(retrieval.items) ? retrieval.items : [];
  if (!items.length) return '';
  const compact = items
    .slice(0, 3)
    .map((item) => `${item.type}: ${item.summary}`)
    .join(' | ');
  return `Strategic Memory Used: ${compact}`;
}

function extractStrategicConclusions(input = {}) {
  return {
    lessonsLearned: extractLessons(input),
    failedHypotheses: extractHypotheses(input, ['CONTRADICTED', 'FAILED']),
    successfulHypotheses: extractHypotheses(input, ['SUPPORTED', 'VALIDATED']),
    founderBeliefChanges: extractBeliefChanges(input)
  };
}

function extractLessons(input = {}) {
  const lessons = [];
  const text = `${input.founderMessage || ''} ${input.agentAnswer || ''}`;
  if (/\blesson\b|\bmust prove\b|\bnot proven\b|\bunproven\b|\brepeat use\b|\bdaily habit\b|\bkiller feature\b/i.test(text)) {
    lessons.push(item('lesson', cleanLesson(text), {
      source: 'conversation_conclusion',
      confidence: 70
    }));
  }

  const critique = input.selfCritique || last(input.selfCritiqueMemory && input.selfCritiqueMemory.recentCritiques);
  if (critique && Array.isArray(critique.missingEvidence) && critique.missingEvidence.length) {
    lessons.push(item('lesson', `Do not treat this as proven until evidence exists: ${critique.missingEvidence[0]}`, {
      source: 'self_critique',
      confidence: critique.confidence || 64
    }));
  }

  const premortem = input.premortemAnalysis ||
    (input.premortemMemory && (input.premortemMemory.lastPremortem || last(input.premortemMemory.recentPremortems)));
  if (premortem && (premortem.mostLikelyFailure || premortem.hiddenFailure)) {
    lessons.push(item('lesson', `Likely failure to remember: ${premortem.mostLikelyFailure || premortem.hiddenFailure}`, {
      source: 'premortem',
      confidence: premortem.confidence || 66
    }));
  }

  return lessons;
}

function extractHypotheses(input = {}, statuses = []) {
  const tracker = input.founderHypothesisTracker || {};
  const hypotheses = Array.isArray(tracker.activeHypotheses) ? tracker.activeHypotheses : [];
  return hypotheses
    .filter((hypothesis) => statuses.includes(String(hypothesis.status || '').toUpperCase()))
    .map((hypothesis) => item('hypothesis', cleanSummary(hypothesis.claim), {
      source: 'founder_hypothesis_tracker',
      status: hypothesis.status,
      hypothesisClass: hypothesis.hypothesisClass,
      evidence: first(hypothesis.currentEvidence) || first(hypothesis.risks) || first(hypothesis.evidenceNeeded),
      confidence: hypothesis.confidence || 60
    }));
}

function extractBeliefChanges(input = {}) {
  const tracker = input.founderBeliefTracker || {};
  const shifts = [
    ...(tracker.lastShift ? [tracker.lastShift] : []),
    ...(Array.isArray(tracker.beliefShifts) ? tracker.beliefShifts : [])
  ];
  return shifts
    .filter((shift) => shift && (shift.beforeBelief || shift.afterBelief))
    .map((shift) => item('belief_change', `${cleanSummary(shift.beforeBelief)} -> ${cleanSummary(shift.afterBelief)}`, {
      source: shift.source || 'founder_belief_tracker',
      reason: shift.changeReason || shift.assumption || null,
      confidence: shift.confidence || 60
    }));
}

function normalizeStrategicMemory(value = {}) {
  return {
    version: '1.0',
    lessonsLearned: array(value && value.lessonsLearned),
    failedHypotheses: array(value && value.failedHypotheses),
    successfulHypotheses: array(value && value.successfulHypotheses),
    founderBeliefChanges: array(value && value.founderBeliefChanges),
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function mergeItems(existing = [], incoming = []) {
  const merged = [...array(incoming), ...array(existing)];
  const seen = new Set();
  const out = [];
  for (const entry of merged) {
    const key = normalizeKey(entry.summary || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

function tagItems(type, items = []) {
  return array(items).map((item) => ({ ...item, type }));
}

function scoreItem(item = {}, queryTokens = []) {
  const bodyTokens = tokenize(`${item.summary || ''} ${item.evidence || ''} ${item.reason || ''} ${item.hypothesisClass || ''}`);
  if (!queryTokens.length) return 1;
  let score = 0;
  for (const token of queryTokens) {
    if (bodyTokens.includes(token)) score += 2;
    if (bodyTokens.some((body) => body.includes(token) || token.includes(body))) score += 1;
  }
  if (/explain|daily|habit|user|dream|killer|feature|leverage/.test(bodyTokens.join(' '))) score += 1;
  return score;
}

function item(kind, summary, extra = {}) {
  return {
    timestamp: new Date().toISOString(),
    kind,
    summary: cleanSummary(summary),
    ...extra
  };
}

function cleanLesson(text = '') {
  const cleaned = cleanSummary(text);
  const match = cleaned.match(/(?:lesson|must prove|not proven|unproven|repeat use|daily habit|killer feature).{0,180}/i);
  return match ? cleanSummary(match[0]) : cleaned;
}

function cleanSummary(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^that\s+/i, '')
    .trim()
    .slice(0, 220);
}

function tokenize(value = '') {
  return cleanSummary(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !['what', 'why', 'how', 'the', 'this', 'that', 'are', 'was', 'were', 'about', 'with'].includes(token));
}

function normalizeKey(value = '') {
  return cleanSummary(value).toLowerCase();
}

function first(items = []) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

function last(items = []) {
  return Array.isArray(items) && items.length ? items[items.length - 1] : null;
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  updateStrategicMemory,
  retrieveRelevantStrategicMemory,
  formatStrategicMemoryForResponse,
  extractStrategicConclusions,
  normalizeStrategicMemory
};
