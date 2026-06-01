const MAX_EVENTS = 80;
const MAX_QUESTIONS_PER_DOMAIN = 8;

function selectAdaptiveFollowUp({
  domain = 'default',
  fallbackQuestion = '',
  memory = {}
} = {}) {
  const model = normalizeAdaptiveCuriosityMemory(memory);
  const candidates = ((model.questionsByDomain || {})[domain] || [])
    .filter((candidate) => candidate && candidate.question)
    .sort((a, b) => b.score - a.score || b.uses - a.uses);

  const best = candidates[0];
  if (best && best.score > 0) {
    return {
      question: best.question,
      domain,
      source: 'learned',
      score: best.score,
      reason: 'historically produced stronger founder engagement, clarity, or insight'
    };
  }

  return {
    question: fallbackQuestion,
    domain,
    source: 'fallback',
    score: 0,
    reason: 'no learned curiosity winner yet'
  };
}

function applyAdaptiveCuriosityToPrompt(curiosity = {}, {
  memory = {}
} = {}) {
  if (!curiosity || !curiosity.shouldAsk || !curiosity.question) return curiosity;
  const selection = selectAdaptiveFollowUp({
    domain: curiosity.domain || 'default',
    fallbackQuestion: curiosity.question,
    memory
  });
  return {
    ...curiosity,
    question: selection.question,
    adaptive: selection
  };
}

function updateAdaptiveCuriosityMemory(existing = {}, event = {}) {
  const model = normalizeAdaptiveCuriosityMemory(existing);
  const question = String(event.question || '').trim();
  if (!question) return model;
  const domain = String(event.domain || 'default').trim() || 'default';
  const outcome = classifyOutcome(event);
  const delta = scoreDelta(outcome, event);
  const previous = ((model.questionsByDomain || {})[domain] || [])
    .find((item) => item.question === question) || {
      question,
      domain,
      score: 0,
      uses: 0,
      positive: 0,
      negative: 0,
      neutral: 0
    };
  const updated = {
    ...previous,
    score: clamp(previous.score + delta, -20, 40),
    uses: previous.uses + 1,
    positive: previous.positive + (outcome === 'positive' ? 1 : 0),
    negative: previous.negative + (outcome === 'negative' ? 1 : 0),
    neutral: previous.neutral + (outcome === 'neutral' ? 1 : 0),
    lastOutcome: outcome,
    lastFounderReply: String(event.founderReply || '').slice(0, 220),
    lastUsedAt: new Date().toISOString()
  };
  const domainQuestions = [
    updated,
    ...((model.questionsByDomain || {})[domain] || []).filter((item) => item.question !== question)
  ]
    .sort((a, b) => b.score - a.score || b.uses - a.uses)
    .slice(0, MAX_QUESTIONS_PER_DOMAIN);
  const questionsByDomain = {
    ...(model.questionsByDomain || {}),
    [domain]: domainQuestions
  };
  const recentEvents = [
    {
      timestamp: new Date().toISOString(),
      domain,
      question,
      outcome,
      delta,
      founderReply: String(event.founderReply || '').slice(0, 220)
    },
    ...model.recentEvents
  ].slice(0, MAX_EVENTS);

  return {
    version: '1.0',
    questionsByDomain,
    recentEvents,
    lastEvent: recentEvents[0] || null,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeAdaptiveCuriosityMemory(value = {}) {
  return {
    version: '1.0',
    questionsByDomain: value && value.questionsByDomain && typeof value.questionsByDomain === 'object'
      ? value.questionsByDomain
      : {},
    recentEvents: Array.isArray(value && value.recentEvents) ? value.recentEvents : [],
    lastEvent: value && value.lastEvent ? value.lastEvent : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function inferCuriosityFeedbackFromDetails(details = {}) {
  const founderReply = String(details.founderReply || details.founderMessage || details.feedback || '').toLowerCase();
  const question = details.curiosityQuestion ||
    details.followUpQuestion ||
    details.question ||
    extractQuestion(details.agentAnswer || details.response || '');
  if (!question) return null;
  const outcome = classifyOutcome({
    outcome: details.outcome,
    founderReply
  });
  return {
    domain: details.curiosityDomain || details.domain || 'default',
    question,
    outcome,
    founderReply
  };
}

function classifyOutcome(event = {}) {
  const explicit = String(event.outcome || '').toLowerCase();
  if (['positive', 'negative', 'neutral'].includes(explicit)) return explicit;
  const reply = String(event.founderReply || '').toLowerCase();
  if (/\b(correct|good|great|useful|exactly|yes|that helps|deep|insight)\b/.test(reply)) return 'positive';
  if (/\b(wrong|bad|generic|not relevant|retry|fix|too generic|too tactical|too philosophical)\b/.test(reply)) return 'negative';
  return 'neutral';
}

function scoreDelta(outcome, event = {}) {
  if (outcome === 'positive') {
    const reply = String(event.founderReply || '').toLowerCase();
    if (/\b(insight|deep|clarity|exactly)\b/.test(reply)) return 8;
    return 5;
  }
  if (outcome === 'negative') return -6;
  return 1;
}

function extractQuestion(text = '') {
  const match = String(text || '').match(/Useful follow-up:\s*([^\n]+)/i);
  return match ? match[1].trim() : '';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  selectAdaptiveFollowUp,
  applyAdaptiveCuriosityToPrompt,
  updateAdaptiveCuriosityMemory,
  normalizeAdaptiveCuriosityMemory,
  inferCuriosityFeedbackFromDetails
};
