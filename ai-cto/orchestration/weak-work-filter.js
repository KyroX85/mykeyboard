function assessWeakWork(input = '') {
  const text = String(input || '').trim();
  const lower = text.toLowerCase();

  if (!text) {
    return weak('Empty request.');
  }

  if (/^(?:make|improve|upgrade|fix|do)\s+(?:(?:the\s+)?(?:it|everything|agents?|system)\s+)?(?:smarter|better|advanced|good|great)?\s*$/i.test(text)) {
    return weak('No specific user pain, artifact, or success condition.');
  }

  if (/\b(smarter|advanced|best|jarvis|paperclip|full system)\b/.test(lower) && !hasConcreteTarget(lower)) {
    return weak('Ambition is high but product target is not concrete.');
  }

  if (/\b(rewrite|modern|scalable|multi-agent|orchestration)\b/.test(lower) && !/\b(explain|screenshot|execution layer|confirm|cancel)\b/.test(lower)) {
    return weak('Sounds like architecture pressure instead of Phase 2 user leverage.');
  }

  return {
    isWeak: false,
    reason: 'Specific enough for product judgment.',
    safeQuestion: ''
  };
}

function weak(reason) {
  return {
    isWeak: true,
    reason,
    safeQuestion: 'Name the user pain, the product surface, and the success condition.'
  };
}

function hasConcreteTarget(text) {
  return /\b(explain|screenshot|glass handle|execution layer|privacy|confirm|cancel|foundation|typing|swipe|prediction|latency)\b/.test(text);
}

function formatWeakWork(assessment) {
  return [
    'Weak Work Detected',
    `Reason: ${assessment.reason}`,
    'No execution started.',
    `Needed: ${assessment.safeQuestion}`
  ].join('\n');
}

module.exports = {
  assessWeakWork,
  formatWeakWork
};
