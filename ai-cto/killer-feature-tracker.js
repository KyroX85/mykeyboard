const MAX_CANDIDATES = 50;

function shouldTrackKillerFeature(text = '') {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) return false;
  if (/^(hi|hey|ok|thanks|latest screenshot|capture screenshot|build now|scan now)$/i.test(value.trim())) {
    return false;
  }
  return /\b(should we|what if|build|add|create|feature|wedge|killer|habit|daily|users?|product|explain|screenshot|workflow)\b/.test(value);
}

function scoreKillerFeature(feature = '', context = {}) {
  const text = String(feature || '').trim();
  const signals = extractSignals(text, context);
  const habitPotential = scoreHabitPotential(signals);
  const frequency = scoreFrequency(signals);
  const painRemoved = scorePainRemoved(signals);
  const totalScore = Math.round(
    habitPotential.score * 0.4 +
    frequency.score * 0.3 +
    painRemoved.score * 0.3
  );
  const classification = classify(totalScore, signals);

  return {
    timestamp: new Date().toISOString(),
    feature: text.slice(0, 280),
    habitPotential,
    frequency,
    painRemoved,
    totalScore,
    classification,
    evidence: evidenceFor(signals),
    recommendation: recommendationFor(classification),
    confidence: confidenceFor(signals)
  };
}

function applyKillerFeatureTrackerToRoute(route = {}, { message = '', context = {} } = {}) {
  if (!route || !route.response || !shouldApplyToRoute(route)) return route;
  if (!shouldTrackKillerFeature(message)) return route;

  const score = scoreKillerFeature(message, context);
  const details = {
    ...(route.details || {}),
    killerFeatureScore: score
  };

  if (score.classification !== 'WEAK_HABIT_POTENTIAL') {
    return {
      ...route,
      details
    };
  }

  return {
    ...route,
    details,
    response: appendWeakHabitFlag(route.response, score)
  };
}

function updateKillerFeatureMemory(existing = {}, score = null) {
  const model = normalizeKillerFeatureMemory(existing);
  if (!score) return model;
  const recentCandidates = [
    score,
    ...model.recentCandidates.filter((item) => item.feature !== score.feature)
  ].slice(0, MAX_CANDIDATES);
  const sorted = [...recentCandidates].sort((a, b) => b.totalScore - a.totalScore);
  return {
    version: '1.0',
    recentCandidates,
    topCandidate: sorted[0] || null,
    killerCandidateCount: recentCandidates.filter((item) => item.classification === 'KILLER_FEATURE_CANDIDATE').length,
    promisingCount: recentCandidates.filter((item) => item.classification === 'PROMISING_HABIT_TEST').length,
    weakHabitCount: recentCandidates.filter((item) => item.classification === 'WEAK_HABIT_POTENTIAL').length,
    lastScore: score,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeKillerFeatureMemory(value = {}) {
  return {
    version: '1.0',
    recentCandidates: Array.isArray(value && value.recentCandidates) ? value.recentCandidates : [],
    topCandidate: value && value.topCandidate ? value.topCandidate : null,
    killerCandidateCount: Number.isFinite(value && value.killerCandidateCount) ? value.killerCandidateCount : 0,
    promisingCount: Number.isFinite(value && value.promisingCount) ? value.promisingCount : 0,
    weakHabitCount: Number.isFinite(value && value.weakHabitCount) ? value.weakHabitCount : 0,
    lastScore: value && value.lastScore ? value.lastScore : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function shouldApplyToRoute(route = {}) {
  const command = String(route.command || route.details && route.details.intent || '');
  if (/\b(build|scan|screenshot|commit|push|approval|approve|execution|preservation|product_lab)\b/i.test(command)) {
    return false;
  }
  const details = route.details || {};
  if (details.skipKillerFeatureTracker) return false;
  return true;
}

function extractSignals(text = '', context = {}) {
  const value = String(text || '').toLowerCase();
  return {
    explain: /\b(explain|understand|screenshot|confusing|bill|notice|form|document|error|message)\b/.test(value),
    daily: /\b(daily|every day|often|repeat|habit|regular|again|multiple times|messages|school|work)\b/.test(value),
    pain: /\b(confusing|stuck|pain|friction|annoy|hard|slow|unclear|stress|doubt|problem)\b/.test(value),
    workflow: /\b(reply|draft|workflow|complete action|prepare|inside keyboard|before typing|whatsapp|conversation)\b/.test(value),
    retention: /\b(return|retain|keep installed|miss|sticky|stickiness|come back|cannot leave)\b/.test(value),
    pay: /\b(pay|paid|premium|subscription|save time|business|productivity)\b/.test(value),
    foundation: /\b(prediction|swipe|theme|settings|keyboard sizing|autocorrect|visual polish)\b/.test(value),
    infrastructure: /\b(infrastructure|architecture|governance|report|memory|orchestration|framework|agent system)\b/.test(value),
    cosmetic: /\b(theme|gradient|animation|beautiful|cosmetic|visual only)\b/.test(value),
    founderContext: Boolean(context && context.founderMemoryLayer)
  };
}

function scoreHabitPotential(signals) {
  let score = 25;
  const reasons = [];
  if (signals.explain) add(25, 'ties to Explain wedge');
  if (signals.daily) add(25, 'fits repeat daily use');
  if (signals.workflow) add(18, 'sits inside a real workflow');
  if (signals.retention) add(18, 'mentions return or stickiness');
  if (signals.infrastructure) add(-30, 'infrastructure rarely becomes a user habit');
  if (signals.cosmetic) add(-18, 'cosmetic appeal is not habit by itself');
  if (signals.foundation && !signals.explain) add(-10, 'foundation work protects trust but is not differentiation');
  return result(score, reasons);

  function add(delta, reason) {
    score += delta;
    reasons.push(reason);
  }
}

function scoreFrequency(signals) {
  let score = 25;
  const reasons = [];
  if (signals.daily) add(35, 'daily/repeated context');
  if (signals.workflow) add(18, 'connected to frequent messaging or work flow');
  if (signals.explain) add(15, 'confusing content can appear repeatedly');
  if (signals.pay) add(10, 'possible productivity context');
  if (signals.infrastructure) add(-25, 'not a user-facing repeated action');
  if (signals.cosmetic) add(-10, 'not naturally repeated after novelty fades');
  return result(score, reasons);

  function add(delta, reason) {
    score += delta;
    reasons.push(reason);
  }
}

function scorePainRemoved(signals) {
  let score = 25;
  const reasons = [];
  if (signals.pain) add(30, 'explicit pain removed');
  if (signals.explain) add(25, 'reduces confusion before typing');
  if (signals.workflow) add(15, 'reduces action or reply friction');
  if (signals.retention) add(10, 'links pain relief to continued use');
  if (signals.infrastructure) add(-22, 'infrastructure pain is founder-side, not user-side');
  if (signals.cosmetic) add(-12, 'cosmetic value does not prove pain removal');
  return result(score, reasons);

  function add(delta, reason) {
    score += delta;
    reasons.push(reason);
  }
}

function result(score, reasons) {
  return {
    score: clamp(score, 0, 100),
    reason: reasons.join('; ') || 'no strong habit evidence'
  };
}

function classify(totalScore, signals) {
  if (signals.infrastructure && !signals.explain && totalScore < 65) return 'WEAK_HABIT_POTENTIAL';
  if (totalScore >= 72) return 'KILLER_FEATURE_CANDIDATE';
  if (totalScore >= 55) return 'PROMISING_HABIT_TEST';
  return 'WEAK_HABIT_POTENTIAL';
}

function evidenceFor(signals) {
  const evidence = [];
  if (signals.explain) evidence.push('Explain / understanding wedge');
  if (signals.daily) evidence.push('repeat daily-use signal');
  if (signals.pain) evidence.push('explicit pain-removal signal');
  if (signals.workflow) evidence.push('workflow/action context');
  if (signals.retention) evidence.push('return or stickiness signal');
  if (signals.infrastructure) evidence.push('infrastructure weak-habit risk');
  if (signals.cosmetic) evidence.push('cosmetic weak-habit risk');
  return evidence.length ? evidence : ['no clear habit-creation signal'];
}

function recommendationFor(classification) {
  if (classification === 'KILLER_FEATURE_CANDIDATE') {
    return 'Prototype only after evidence shows repeated daily use and pain removal.';
  }
  if (classification === 'PROMISING_HABIT_TEST') {
    return 'Keep as a small habit test; prove frequency before implementation scope grows.';
  }
  return 'Do not prioritize until it proves habit potential, frequency, and pain removed.';
}

function confidenceFor(signals) {
  const signalCount = Object.values(signals).filter(Boolean).length;
  return clamp(45 + signalCount * 7, 45, 88);
}

function appendWeakHabitFlag(response = '', score = {}) {
  if (String(response || '').includes('Killer feature check:')) return response;
  return [
    response,
    '',
    `Killer feature check: Weak habit potential.`,
    `Habit Potential: ${scoreOf(score.habitPotential)}; Frequency: ${scoreOf(score.frequency)}; Pain Removed: ${scoreOf(score.painRemoved)}.`,
    `Product focus: ${score.recommendation}`
  ].join('\n');
}

function scoreOf(value = {}) {
  return Number.isFinite(value.score) ? `${value.score}/100` : 'unknown';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldTrackKillerFeature,
  scoreKillerFeature,
  applyKillerFeatureTrackerToRoute,
  updateKillerFeatureMemory,
  normalizeKillerFeatureMemory
};
