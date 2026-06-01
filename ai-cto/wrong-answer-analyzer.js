const MAX_RECENT_FAILURES = 40;

function analyzeWrongAnswer(feedbackEntry = {}) {
  if (!feedbackEntry || feedbackEntry.polarity !== 'negative') return null;

  const question = String(feedbackEntry.rawQuestionPreview || feedbackEntry.questionPattern || '');
  const answer = String(feedbackEntry.rawAnswerPreview || feedbackEntry.answerPattern || '');
  const feedback = String(feedbackEntry.feedback || '');
  const failureReasons = [];

  if (looksLikeExecutionLeak(answer) || feedback === 'too_much_cto_mode') {
    failureReasons.push('wrong_route');
  }
  if (feedback === 'too_generic' || isTooShallow(answer, question)) {
    failureReasons.push('wrong_depth');
  }
  if (feedback === 'too_much_cto_mode' || feedback === 'too_optimistic' || feedback === 'too_philosophical' || looksStatusLike(answer)) {
    failureReasons.push('wrong_tone');
  }
  if (feedback === 'wrong' || feedback === 'not_relevant' || answerMissesFounderQuestion(question, answer) || looksLikeExecutionLeak(answer)) {
    failureReasons.push('wrong_assumption');
  }
  if (feedback === 'too_tactical' || feedback === 'too_philosophical' || feedback === 'too_generic' || hasAbstractionMismatch(question, answer)) {
    failureReasons.push('wrong_abstraction_level');
  }

  const uniqueReasons = [...new Set(failureReasons)];
  if (!uniqueReasons.length) uniqueReasons.push('unknown_failure');

  return {
    timestamp: feedbackEntry.timestamp || new Date().toISOString(),
    primaryFailureReason: choosePrimaryFailure(uniqueReasons),
    failureReasons: uniqueReasons,
    feedback,
    questionPattern: feedbackEntry.questionPattern || normalize(question),
    answerPattern: feedbackEntry.answerPattern || normalize(answer),
    evidence: buildEvidence(uniqueReasons, question, answer, feedback),
    confidence: confidenceFor(uniqueReasons, feedback)
  };
}

function updateWrongAnswerMemory(existing = {}, analysis = null) {
  const memory = normalizeWrongAnswerMemory(existing);
  if (!analysis) return memory;

  const failureCounts = { ...memory.failureCounts };
  for (const reason of analysis.failureReasons || []) {
    failureCounts[reason] = (failureCounts[reason] || 0) + 1;
  }

  return {
    version: '1.0',
    totalFailures: memory.totalFailures + 1,
    failureCounts,
    recentFailures: [analysis, ...memory.recentFailures].slice(0, MAX_RECENT_FAILURES),
    lastFailure: analysis,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeWrongAnswerMemory(value = {}) {
  return {
    version: '1.0',
    totalFailures: Number.isFinite(value && value.totalFailures) ? value.totalFailures : 0,
    failureCounts: value && typeof value.failureCounts === 'object' && value.failureCounts ? value.failureCounts : {},
    recentFailures: Array.isArray(value && value.recentFailures) ? value.recentFailures : [],
    lastFailure: value && value.lastFailure ? value.lastFailure : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function choosePrimaryFailure(reasons = []) {
  const priority = [
    'wrong_route',
    'wrong_assumption',
    'wrong_depth',
    'wrong_abstraction_level',
    'wrong_tone',
    'unknown_failure'
  ];
  return priority.find((reason) => reasons.includes(reason)) || reasons[0] || 'unknown_failure';
}

function looksLikeExecutionLeak(answer = '') {
  return /\b(TASK_PLAN|APPROVE|Execution Plan|Files:|Validation:|Health:\s*\d+|Momentum|Team is ready|Coder:\s*Ready|Reviewer:\s*Ready|complexity report)\b/i.test(answer);
}

function looksStatusLike(answer = '') {
  return /\b(health|momentum|status|team is online|team ready|report|pipeline|task)\b/i.test(answer);
}

function isTooShallow(answer = '', question = '') {
  const words = String(answer || '').trim().split(/\s+/).filter(Boolean).length;
  const asksStrategic = /\b(chasing|dream|vision|wrong thing|users?|care|fail|satisfied|optimizing|belief|strategy)\b/i.test(question);
  return asksStrategic && words < 28;
}

function answerMissesFounderQuestion(question = '', answer = '') {
  const q = normalize(question);
  const a = normalize(answer);
  if (!q || !a) return false;
  if (/\bdream|vision\b/.test(q)) return !/\bdream|vision|alignment|direction|infrastructure|user|leverage\b/.test(a);
  if (/\busers?|care|useful\b/.test(q)) return !/\buser|care|pain|useful|behavior|need|value\b/.test(a);
  if (/\bwrong thing|off|satisfied\b/.test(q)) return !/\bconcern|misalignment|value|useful|why|gap|feels\b/.test(a);
  return false;
}

function hasAbstractionMismatch(question = '', answer = '') {
  const q = normalize(question);
  const a = normalize(answer);
  const founderReflection = /\bwhy|what|dream|chasing|satisfied|wrong|users|fail|optimizing\b/.test(q);
  const tooAbstract = /\bphilosophy|organism|identity|sophistication|architecture\b/.test(a) && !/\buser|pain|value|trust|evidence\b/.test(a);
  const tooTactical = /\bfile|function|commit|patch|workflow|line|module\b/.test(a) && founderReflection;
  return tooAbstract || tooTactical;
}

function buildEvidence(reasons = [], question = '', answer = '', feedback = '') {
  const evidence = [];
  if (reasons.includes('wrong_route')) evidence.push('answer contained execution/status artifacts for a founder conversation');
  if (reasons.includes('wrong_depth')) evidence.push('answer was too shallow for a strategic or reflective founder question');
  if (reasons.includes('wrong_tone')) evidence.push(`founder feedback or answer tone indicated ${readable(feedback || 'tone mismatch')}`);
  if (reasons.includes('wrong_assumption')) evidence.push('answer appeared to solve a different problem than the founder was testing');
  if (reasons.includes('wrong_abstraction_level')) evidence.push('answer abstraction level did not match the founder question');
  return evidence.length ? evidence : ['negative feedback received but failure reason is uncertain'];
}

function confidenceFor(reasons = [], feedback = '') {
  let score = 55 + Math.min(30, reasons.length * 8);
  if (feedback) score += 5;
  return Math.min(90, score);
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function readable(value = '') {
  return String(value || '').replace(/_/g, ' ') || 'tone mismatch';
}

module.exports = {
  analyzeWrongAnswer,
  updateWrongAnswerMemory,
  normalizeWrongAnswerMemory
};
