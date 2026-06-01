const MAX_RECENT_STATES = 40;

const STATE_RULES = Object.freeze({
  REFLECTION: {
    routingHint: 'FOUNDER_REFLECTION',
    guidance: 'Answer the reason behind the founder thought. Keep the reply human, direct, and reflective.',
    signals: [
      { pattern: /\breplaying\b|\bpattern\b|\bmy own decisions\b|\bchanged\b|\bevolved\b|\bsame founder\b/i, weight: 3, label: 'self-pattern language' },
      { pattern: /\bwhy did i\b|\bwhy am i\b|\bwhat am i\b|\bbased on my behavior\b/i, weight: 4, label: 'self-questioning language' }
    ]
  },
  DOUBT: {
    routingHint: 'FOUNDER_DOUBT',
    guidance: 'Surface the hidden concern and strategic unease. Stay in discussion unless the founder explicitly asks for a code change.',
    signals: [
      { pattern: /\bdoes not sit right\b|\bnot sit right\b|\bfeels off\b|\bfeel off\b|\bsomething wrong\b|\bwrong direction\b|\bmissing something\b/i, weight: 5, label: 'unease without a command' },
      { pattern: /\bnot convinced\b|\bnot sure\b|\bnot working\b|\bwrong thing\b|\busers actually care\b/i, weight: 4, label: 'confidence challenge' }
    ]
  },
  VISION: {
    routingHint: 'FOUNDER_VISION',
    guidance: 'Connect the founder dream, current direction, and the gap to user value. Avoid generic roadmap blocks.',
    signals: [
      { pattern: /\bif this works\b|\bif we win\b|\bworld look like\b|\blong term\b|\bcategory\b|\bdream\b|\bvision\b/i, weight: 4, label: 'future-state language' },
      { pattern: /\bphone intelligence layer\b|\bpersonal intelligence\b|\bpeople should use\b|\busers should use\b/i, weight: 5, label: 'dream outcome language' }
    ]
  },
  STRATEGY: {
    routingHint: 'FOUNDER_STRATEGY',
    guidance: 'Compare tradeoffs, opportunity cost, and second-order effects. Keep execution separate.',
    signals: [
      { pattern: /\bsix months\b|\bwhat do we lose\b|\belsewhere\b|\btradeoff\b|\bopportunity cost\b|\bwhat happens if\b/i, weight: 5, label: 'tradeoff framing' },
      { pattern: /\bfocus\b|\bprioritize\b|\bshould we\b|\bwould we\b|\bwhat path\b|\bwhich move\b/i, weight: 3, label: 'strategic choice framing' }
    ]
  },
  FRUSTRATION: {
    routingHint: 'FOUNDER_FRUSTRATION',
    guidance: 'Reduce friction, acknowledge the mismatch, and answer directly. Do not defend the system or dump templates.',
    signals: [
      { pattern: /\btired\b|\bannoying\b|\bexhausting\b|\birritated\b|\bkeeps missing\b|\bnot listening\b|\bmissing what i mean\b/i, weight: 5, label: 'interaction fatigue language' },
      { pattern: /\bsame answer\b|\btoo generic\b|\bbad route\b|\bwrong answer\b|\bnot relevant\b/i, weight: 4, label: 'response rejection language' }
    ]
  },
  CURIOSITY: {
    routingHint: 'FOUNDER_CURIOSITY',
    guidance: 'Explore the question with a useful answer or one sharp follow-up. Do not collapse curiosity into a command.',
    signals: [
      { pattern: /\bwhat would change\b|\bwhat if\b|\bwhy would\b|\bhow would\b|\bcould it\b|\bsuppose\b/i, weight: 4, label: 'open exploration language' },
      { pattern: /\bif users\b|\bif people\b|\bif this\b|\bwhat would happen\b/i, weight: 3, label: 'hypothetical product inquiry' }
    ]
  }
});

function estimateFounderMentalState(message = '', context = {}) {
  const original = String(message || '').trim();
  const text = normalize(original);
  if (!text) {
    return buildEstimate({
      original,
      primaryState: 'UNKNOWN',
      scores: emptyScores(),
      signals: [],
      confidence: 30
    });
  }

  const scores = emptyScores();
  const signals = [];

  for (const [state, rule] of Object.entries(STATE_RULES)) {
    for (const signal of rule.signals) {
      if (signal.pattern.test(text)) {
        scores[state] += signal.weight;
        signals.push({
          state,
          label: signal.label,
          weight: signal.weight
        });
      }
    }
  }

  applyShapeSignals(text, scores, signals);
  applyContextContinuity(context, scores, signals);

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [primaryState, topScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  if (!topScore) {
    return buildEstimate({
      original,
      primaryState: 'UNKNOWN',
      scores,
      signals,
      confidence: 35
    });
  }

  const ambiguityPenalty = Math.max(0, secondScore - Math.max(0, topScore - 3)) * 4;
  const confidence = clamp(48 + topScore * 7 - ambiguityPenalty, 45, 88);

  return buildEstimate({
    original,
    primaryState,
    scores,
    signals: signals.filter((signal) => signal.state === primaryState || signal.weight >= 3),
    confidence
  });
}

function updateFounderMentalStateMemory(existing, estimate) {
  const memory = normalizeFounderMentalStateMemory(existing);
  if (!estimate || !estimate.primaryState || estimate.primaryState === 'UNKNOWN') return memory;

  const stateCounts = { ...memory.stateCounts };
  stateCounts[estimate.primaryState] = (stateCounts[estimate.primaryState] || 0) + 1;

  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastState: estimate,
    stateCounts,
    recentStates: [estimate, ...memory.recentStates].slice(0, MAX_RECENT_STATES)
  };
}

function normalizeFounderMentalStateMemory(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastState: source.lastState || null,
    stateCounts: source.stateCounts && typeof source.stateCounts === 'object'
      ? { ...source.stateCounts }
      : {},
    recentStates: Array.isArray(source.recentStates)
      ? source.recentStates.filter(Boolean).slice(0, MAX_RECENT_STATES)
      : []
  };
}

function buildEstimate({ original, primaryState, scores, signals, confidence }) {
  const rule = STATE_RULES[primaryState] || {};
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    messagePreview: String(original || '').slice(0, 180),
    primaryState,
    routingHint: rule.routingHint || 'FOUNDER_CONVERSATION',
    confidence,
    scores,
    signals,
    responseGuidance: rule.guidance || 'Answer conversationally and avoid execution unless explicitly requested.'
  };
}

function applyShapeSignals(text, scores, signals) {
  if (/\?$/.test(text) && /\bwhat|why|how|could|would|if\b/i.test(text)) {
    scores.CURIOSITY += 1;
    signals.push({ state: 'CURIOSITY', label: 'question shape', weight: 1 });
  }
  if (/\bi\b.*\bfeel\b|\bmy\b.*\bfeeling\b|\bdoes not\b/i.test(text)) {
    scores.DOUBT += 1;
    signals.push({ state: 'DOUBT', label: 'personal uncertainty shape', weight: 1 });
  }
  if (/\bwe\b.*\bspend\b|\bwe\b.*\bfocus\b|\bwe\b.*\blose\b/i.test(text)) {
    scores.STRATEGY += 1;
    signals.push({ state: 'STRATEGY', label: 'collective tradeoff shape', weight: 1 });
  }
}

function applyContextContinuity(context = {}, scores, signals) {
  const previous = context.previousMentalState ||
    (context.founderMentalStateMemory && context.founderMentalStateMemory.lastState);
  if (!previous || !previous.primaryState || !scores[previous.primaryState]) return;

  const highest = Math.max(...Object.values(scores));
  if (highest > 0 && highest <= 3) {
    scores[previous.primaryState] += 1;
    signals.push({
      state: previous.primaryState,
      label: 'weak-signal continuity',
      weight: 1
    });
  }
}

function emptyScores() {
  return {
    REFLECTION: 0,
    DOUBT: 0,
    VISION: 0,
    STRATEGY: 0,
    FRUSTRATION: 0,
    CURIOSITY: 0
  };
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

module.exports = {
  estimateFounderMentalState,
  updateFounderMentalStateMemory,
  normalizeFounderMentalStateMemory
};
