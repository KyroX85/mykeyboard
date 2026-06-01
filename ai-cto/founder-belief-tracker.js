const MAX_BELIEF_SHIFTS = 30;
const MAX_CURRENT_BELIEFS = 12;
const MAX_ASSUMPTIONS = 20;

function extractFounderBeliefShift(details = {}) {
  const founderMessage = String(details.founderMessage || '');
  const agentAnswer = String(details.agentAnswer || '');
  const intent = String(details.intent || '');
  const category = String(details.category || '');
  const mind = details.mindReconstruction || {};

  const explicit = extractExplicitShift(founderMessage);
  if (explicit) {
    return buildShift({
      ...explicit,
      source: 'explicit_founder_statement',
      details,
      confidence: 88
    });
  }

  if (intent === 'RECONSTRUCT_RECENT_BELIEF_SHIFT' || /changed\s+my\s+mind|belief/i.test(founderMessage)) {
    const inferred = extractShiftFromAnswer(agentAnswer) || {
      beforeBelief: 'agents becoming advanced enough would move the product toward the dream',
      afterBelief: 'real user leverage and repeatable usefulness matter more than agent sophistication'
    };
    return buildShift({
      ...inferred,
      source: 'inferred_from_reflection',
      details,
      confidence: 78
    });
  }

  if (category === 'DOUBT' || category === 'VISION' || category === 'FOUNDER_STRATEGY') {
    const assumption = mind.assumption || inferAssumption(founderMessage);
    if (!assumption) return null;
    return buildShift({
      beforeBelief: 'current direction may have been assumed sufficient',
      afterBelief: assumption,
      source: 'inferred_assumption_pressure',
      details,
      confidence: 62
    });
  }

  return null;
}

function updateFounderBeliefTracker(existing = {}, shift = null) {
  const tracker = normalizeFounderBeliefTracker(existing);
  if (!shift) return tracker;
  const key = beliefKey(shift);
  const beliefShifts = [
    shift,
    ...tracker.beliefShifts.filter((item) => beliefKey(item) !== key)
  ].slice(0, MAX_BELIEF_SHIFTS);
  const currentBeliefs = mergeCurrentBelief(tracker.currentBeliefs, shift);
  const assumptions = mergeAssumption(tracker.assumptions, shift);

  return {
    version: '1.0',
    beliefShifts,
    currentBeliefs,
    assumptions,
    lastShift: shift,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeFounderBeliefTracker(value = {}) {
  return {
    version: '1.0',
    beliefShifts: Array.isArray(value && value.beliefShifts) ? value.beliefShifts : [],
    currentBeliefs: Array.isArray(value && value.currentBeliefs) ? value.currentBeliefs : [],
    assumptions: Array.isArray(value && value.assumptions) ? value.assumptions : [],
    lastShift: value && value.lastShift ? value.lastShift : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function extractExplicitShift(text = '') {
  const direct = String(text || '').match(/\b(?:i\s+)?used\s+to\s+think\s+(.+?)\s*,?\s+but\s+now\s+(.+?)(?:\.|$)/i);
  if (direct) {
    return {
      beforeBelief: cleanBelief(direct[1]),
      afterBelief: cleanBelief(direct[2])
    };
  }
  const beforeAfter = String(text || '').match(/\bbefore\s*:?\s*(.+?)\s+(?:after|now)\s*:?\s*(.+?)(?:\.|$)/i);
  if (beforeAfter) {
    return {
      beforeBelief: cleanBelief(beforeAfter[1]),
      afterBelief: cleanBelief(beforeAfter[2])
    };
  }
  return null;
}

function extractShiftFromAnswer(answer = '') {
  const before = String(answer || '').match(/\bEarlier,?\s+the\s+belief\s+was\s+closer\s+to\s*:?\s*(.+?)(?:\.|\n)/i) ||
    String(answer || '').match(/\bbefore\s*:?\s*(.+?)(?:\.|\n)/i);
  const after = String(answer || '').match(/\bRecently,?\s+[^:]*belief\s*:?\s*(.+?)(?:\.|\n)/i) ||
    String(answer || '').match(/\bThe\s+new\s+belief\s+is\s*:?\s*(.+?)(?:\.|\n)/i) ||
    String(answer || '').match(/\bafter\s*:?\s*(.+?)(?:\.|\n)/i);
  if (!before && !after) return null;
  return {
    beforeBelief: cleanBelief(before ? before[1] : 'older belief unclear'),
    afterBelief: cleanBelief(after ? after[1] : 'new belief unclear')
  };
}

function buildShift({ beforeBelief, afterBelief, source, details = {}, confidence }) {
  const mind = details.mindReconstruction || {};
  return {
    timestamp: new Date().toISOString(),
    beforeBelief: cleanBelief(beforeBelief),
    afterBelief: cleanBelief(afterBelief),
    assumption: mind.assumption || inferAssumption(details.founderMessage) || null,
    changeReason: mind.concern || inferChangeReason(details.founderMessage, details.agentAnswer),
    source,
    intent: details.intent || null,
    category: details.category || null,
    confidence: Math.min(90, Math.max(0, confidence || details.confidence || 60))
  };
}

function mergeCurrentBelief(items = [], shift = {}) {
  const belief = shift.afterBelief;
  if (!belief) return array(items).slice(0, MAX_CURRENT_BELIEFS);
  const entry = {
    belief,
    sourceShift: beliefKey(shift),
    confidence: shift.confidence,
    updatedAt: new Date().toISOString()
  };
  return [
    entry,
    ...array(items).filter((item) => normalize(item.belief) !== normalize(belief))
  ].slice(0, MAX_CURRENT_BELIEFS);
}

function mergeAssumption(items = [], shift = {}) {
  const assumption = shift.assumption || shift.changeReason;
  if (!assumption) return array(items).slice(0, MAX_ASSUMPTIONS);
  const entry = {
    assumption: cleanBelief(assumption),
    sourceShift: beliefKey(shift),
    confidence: shift.confidence,
    updatedAt: new Date().toISOString()
  };
  return [
    entry,
    ...array(items).filter((item) => normalize(item.assumption) !== normalize(assumption))
  ].slice(0, MAX_ASSUMPTIONS);
}

function inferAssumption(message = '') {
  const text = String(message || '');
  if (/users?.*care|useful|value/i.test(text)) return 'user leverage matters more than impressive capability';
  if (/dream|vision/i.test(text)) return 'work must stay aligned with the long-term Aritenis dream';
  if (/wrong thing|off|satisfied/i.test(text)) return 'current focus may be misaligned with product value';
  return null;
}

function inferChangeReason(message = '', answer = '') {
  const text = `${message || ''} ${answer || ''}`;
  if (/user|leverage|useful|value/i.test(text)) return 'founder increasingly prioritizes user leverage over agent sophistication';
  if (/dream|vision/i.test(text)) return 'founder is checking whether work still serves the dream';
  return 'belief shift inferred from founder reflection';
}

function beliefKey(shift = {}) {
  return `${normalize(shift.beforeBelief)}->${normalize(shift.afterBelief)}`;
}

function cleanBelief(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^that\s+/i, '')
    .trim()
    .slice(0, 220);
}

function normalize(value = '') {
  return cleanBelief(value).toLowerCase();
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  extractFounderBeliefShift,
  updateFounderBeliefTracker,
  normalizeFounderBeliefTracker
};
