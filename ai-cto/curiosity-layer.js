function buildCuriosityPrompt({
  message = '',
  category = '',
  intent = '',
  confidence = 100,
  concern = '',
  objective = ''
} = {}) {
  const text = `${message} ${category} ${intent} ${concern} ${objective}`.toLowerCase();
  const domain = classifyCuriosityDomain(text);
  const shouldAsk = Number(confidence) < 84 ||
    ['dissatisfaction', 'strategic_doubt', 'vision_alignment', 'agent_understanding'].includes(domain);

  if (!shouldAsk) {
    return {
      shouldAsk: false,
      domain,
      question: '',
      reason: 'confidence high enough; no follow-up needed'
    };
  }

  const question = CURIOSITY_QUESTIONS[domain] || CURIOSITY_QUESTIONS.default;
  return {
    shouldAsk: true,
    domain,
    question,
    reason: 'founder signal is meaningful but under-specified; ask a diagnostic follow-up'
  };
}

function formatCuriosityPrompt(curiosity = {}) {
  if (!curiosity || !curiosity.shouldAsk || !curiosity.question) return '';
  return `Useful follow-up: ${curiosity.question}`;
}

function responseUsesRealCuriosity(response = '') {
  const text = String(response || '');
  return /Useful follow-up:/i.test(text) &&
    !/what feature\?|please clarify|provide more details|what do you mean/i.test(text);
}

function classifyCuriosityDomain(text = '') {
  if (/\b(don'?t like|do not like|not satisfied|dissatisfied|unsatisfied|doesn'?t feel|not feel|feature)\b/.test(text)) {
    return 'dissatisfaction';
  }
  if (/\b(wrong thing|wrong direction|misaligned|focus|focusing|off)\b/.test(text)) {
    return 'strategic_doubt';
  }
  if (/\b(dream|vision|chasing|ambition|goal)\b/.test(text)) {
    return 'vision_alignment';
  }
  if (/\b(agents?|understand|template|rule based|dumb|basic|intelligent)\b/.test(text)) {
    return 'agent_understanding';
  }
  if (/\b(screenshot|explain|action surface|glass handle|execution layer)\b/.test(text)) {
    return 'phase2_explain';
  }
  return 'default';
}

const CURIOSITY_QUESTIONS = {
  dissatisfaction: 'Is the issue capability, design, trust, or emotional reaction?',
  strategic_doubt: 'Which axis feels off: product direction, user value, trust, or agent behavior?',
  vision_alignment: 'Are you asking whether today\'s work creates user leverage, or whether it only makes the system look more advanced?',
  agent_understanding: 'Do you want proof through better answers, better autonomous suggestions, or better shipped results?',
  phase2_explain: 'Is the uncertainty about user value, privacy safety, activation friction, or technical feasibility?',
  default: 'Which part matters most here: user value, trust risk, speed, or strategic leverage?'
};

module.exports = {
  buildCuriosityPrompt,
  formatCuriosityPrompt,
  responseUsesRealCuriosity
};
