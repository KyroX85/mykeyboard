const MAX_JUDGMENTS = 40;

function shouldJudgeIdea(text = '') {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) return false;
  return /\b(idea|build|create|add|feature|proposal|should we|what if|experiment|improve|design)\b/.test(value) &&
    !/\b(memory audit|status|what happened|how are things|hi bro)\b/.test(value);
}

function judgeUserValue(idea = '', context = {}) {
  const text = String(idea || '').trim();
  const signals = extractSignals(text, context);
  const questions = {
    wouldUserNotice: scoreQuestion('wouldUserNotice', signals),
    wouldUserCare: scoreQuestion('wouldUserCare', signals),
    wouldUserReturn: scoreQuestion('wouldUserReturn', signals),
    wouldUserPay: scoreQuestion('wouldUserPay', signals)
  };
  const totalScore = Math.round(
    questions.wouldUserNotice.score * 0.25 +
    questions.wouldUserCare.score * 0.3 +
    questions.wouldUserReturn.score * 0.3 +
    questions.wouldUserPay.score * 0.15
  );
  const infrastructureRisk = infrastructureRiskScore(signals);
  const trustImpact = trustImpactScore(signals);
  const verdict = verdictFor(totalScore, infrastructureRisk);

  return {
    timestamp: new Date().toISOString(),
    idea: text.slice(0, 260),
    questions,
    totalScore,
    verdict,
    infrastructureRisk,
    trustImpact,
    recommendation: recommendationFor(verdict, infrastructureRisk, trustImpact),
    evidence: evidenceFor(signals),
    confidence: confidenceFor(signals)
  };
}

function updateUserValueJudgments(existing = {}, judgment = null) {
  const model = normalizeUserValueJudgments(existing);
  if (!judgment) return model;
  const recentJudgments = [
    judgment,
    ...model.recentJudgments.filter((item) => item.idea !== judgment.idea)
  ].slice(0, MAX_JUDGMENTS);
  return {
    version: '1.0',
    recentJudgments,
    highValueCount: recentJudgments.filter((item) => item.verdict === 'HIGH_USER_VALUE').length,
    mediumValueCount: recentJudgments.filter((item) => item.verdict === 'MEDIUM_USER_VALUE').length,
    lowValueCount: recentJudgments.filter((item) => item.verdict === 'LOW_USER_VALUE').length,
    lastJudgment: judgment,
    lastUpdatedAt: new Date().toISOString()
  };
}

function applyUserValueJudgeToRoute(route = {}, { message = '', context = {} } = {}) {
  if (!route || !route.response || !shouldApplyToRoute(route)) return route;
  if (!shouldJudgeIdea(message)) return route;

  const judgment = judgeUserValue(message, {
    ...(context || {}),
    routeCommand: route.command,
    routeDetails: route.details || {}
  });
  const details = {
    ...(route.details || {}),
    userValueJudgment: judgment
  };

  if (judgment.verdict !== 'LOW_USER_VALUE') {
    return {
      ...route,
      details
    };
  }

  return {
    ...route,
    details,
    response: appendWeakLeverageFlag(route.response, judgment)
  };
}

function shouldApplyToRoute(route = {}) {
  const command = String(route.command || route.details && route.details.intent || '');
  const blocked = /\b(build|scan|screenshot|commit|push|approval|approve|execution|preservation|product_lab)\b/i;
  if (blocked.test(command)) return false;
  const details = route.details || {};
  if (details.skipUserValueJudge) return false;
  return true;
}

function appendWeakLeverageFlag(response = '', judgment = {}) {
  if (String(response || '').includes('Weak leverage:')) return response;
  const questions = judgment.questions || {};
  const compact = [
    `Would users care: ${scoreOf(questions.wouldUserCare)}`,
    `Would users pay: ${scoreOf(questions.wouldUserPay)}`,
    `Would users return: ${scoreOf(questions.wouldUserReturn)}`,
    `Would users notice if removed: ${scoreOf(questions.wouldUserNotice)}`
  ].join('; ');
  return [
    response,
    '',
    `Weak leverage: users may not care enough yet. ${compact}.`,
    `Product focus: ${judgment.recommendation || 'Do not prioritize until user value is clearer.'}`
  ].join('\n');
}

function scoreOf(value = {}) {
  return Number.isFinite(value.score) ? `${value.score}/100` : 'unknown';
}

function normalizeUserValueJudgments(value = {}) {
  return {
    version: '1.0',
    recentJudgments: Array.isArray(value && value.recentJudgments) ? value.recentJudgments : [],
    highValueCount: Number.isFinite(value && value.highValueCount) ? value.highValueCount : 0,
    mediumValueCount: Number.isFinite(value && value.mediumValueCount) ? value.mediumValueCount : 0,
    lowValueCount: Number.isFinite(value && value.lowValueCount) ? value.lowValueCount : 0,
    lastJudgment: value && value.lastJudgment ? value.lastJudgment : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function extractSignals(text = '', context = {}) {
  const lower = text.toLowerCase();
  return {
    phase2Explain: /\b(explain|understand|screenshot|bill|notice|form|document|error|message)\b/.test(lower),
    userPain: /\b(confusing|pain|friction|hesitation|frustration|annoy|hard|slow|effort|stuck)\b/.test(lower),
    dailyUse: /\b(daily|often|repeat|return|habit|every day|messages|whatsapp|keyboard)\b/.test(lower),
    trust: /\b(trust|typing|swipe|correction|latency|privacy|local|safe|confidence)\b/.test(lower),
    payment: /\b(pay|paid|premium|subscription|save time|business|work|school|productivity)\b/.test(lower),
    infrastructure: /\b(infrastructure|architecture|framework|orchestration|governance|report|memory layer|agent system|multi-agent|scalable|modern)\b/.test(lower),
    cosmetic: /\b(theme|cosmetic|animation|gradient|visual polish only)\b/.test(lower),
    hotPathRisk: /\b(rewrite|prediction|keyboardservice|hot path|autocorrect|swipe resolver)\b/.test(lower),
    founderContext: context && context.founderMemoryLayer ? 1 : 0
  };
}

function scoreQuestion(question, signals) {
  let score = 20;
  const reasons = [];
  if (signals.phase2Explain) {
    score += question === 'wouldUserPay' ? 20 : 30;
    reasons.push('ties to Explain or understanding wedge');
  }
  if (signals.userPain) {
    score += question === 'wouldUserNotice' ? 25 : 20;
    reasons.push('names visible user pain');
  }
  if (signals.dailyUse) {
    score += question === 'wouldUserReturn' ? 30 : 15;
    reasons.push('fits repeated daily context');
  }
  if (signals.trust) {
    score += question === 'wouldUserReturn' ? 20 : 12;
    reasons.push('protects or improves trust');
  }
  if (signals.payment) {
    score += question === 'wouldUserPay' ? 30 : 8;
    reasons.push('has possible paid-use context');
  }
  if (signals.infrastructure) {
    score -= question === 'wouldUserNotice' ? 35 : 25;
    reasons.push('infrastructure is not directly user-visible');
  }
  if (signals.cosmetic) {
    score -= 15;
    reasons.push('cosmetic value is weak unless tied to trust');
  }
  if (signals.hotPathRisk && question !== 'wouldUserReturn') {
    score -= 8;
    reasons.push('hot-path risk must be justified by evidence');
  }
  return {
    score: clamp(score, 0, 100),
    reason: reasons.join('; ') || 'no strong user-value evidence'
  };
}

function infrastructureRiskScore(signals) {
  let score = 0;
  if (signals.infrastructure) score += 75;
  if (signals.hotPathRisk) score += 15;
  if (signals.phase2Explain || signals.userPain) score -= 20;
  return clamp(score, 0, 100);
}

function trustImpactScore(signals) {
  let score = 35;
  if (signals.trust) score += 35;
  if (signals.userPain) score += 15;
  if (signals.hotPathRisk) score -= 15;
  if (signals.infrastructure && !signals.trust) score -= 10;
  return clamp(score, 0, 100);
}

function verdictFor(totalScore, infrastructureRisk) {
  if (infrastructureRisk >= 70 && totalScore < 60) return 'LOW_USER_VALUE';
  if (totalScore >= 70) return 'HIGH_USER_VALUE';
  if (totalScore >= 45) return 'MEDIUM_USER_VALUE';
  return 'LOW_USER_VALUE';
}

function recommendationFor(verdict, infrastructureRisk, trustImpact) {
  if (verdict === 'HIGH_USER_VALUE') {
    return 'Worth exploring as a bounded product proposal; validate evidence before implementation.';
  }
  if (verdict === 'MEDIUM_USER_VALUE') {
    return 'Keep as a small experiment only if trust risk is low and evidence improves.';
  }
  if (infrastructureRisk >= 70) {
    return 'Do not prioritize. Convert infrastructure into a user-visible outcome first.';
  }
  if (trustImpact < 45) {
    return 'Do not prioritize until it clearly improves user trust, return behavior, or willingness to pay.';
  }
  return 'Do not prioritize without stronger user pain evidence.';
}

function evidenceFor(signals) {
  const evidence = [];
  if (signals.phase2Explain) evidence.push('Explain or screenshot understanding signal');
  if (signals.userPain) evidence.push('explicit user pain signal');
  if (signals.dailyUse) evidence.push('repeat-use context');
  if (signals.trust) evidence.push('trust or keyboard confidence signal');
  if (signals.payment) evidence.push('possible paid-use signal');
  if (signals.infrastructure) evidence.push('infrastructure risk signal');
  return evidence.length ? evidence : ['no clear user-value signal'];
}

function confidenceFor(signals) {
  const positiveSignals = ['phase2Explain', 'userPain', 'dailyUse', 'trust', 'payment', 'infrastructure']
    .filter((key) => signals[key]).length;
  return clamp(45 + positiveSignals * 8, 45, 88);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldJudgeIdea,
  judgeUserValue,
  updateUserValueJudgments,
  normalizeUserValueJudgments,
  applyUserValueJudgeToRoute
};
