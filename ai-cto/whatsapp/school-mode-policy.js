function classifyDecision({ risk = 'LOW', size = 'small', stuckAttempts = 0, options = [] } = {}) {
  const normalizedRisk = String(risk || 'LOW').toUpperCase();
  const normalizedSize = String(size || 'small').toLowerCase();
  if (stuckAttempts >= 1) {
    return {
      mode: 'ASK_FOUNDER',
      reason: 'stuck_after_one_attempt',
      message: 'Tried once, stuck. Ask Founder Sir immediately.'
    };
  }
  if (normalizedRisk === 'LOW' && normalizedSize === 'small') {
    return {
      mode: 'DECIDE_AND_REPORT',
      reason: 'small_low_risk',
      message: 'Decide, apply only bounded safe action, then explain what changed and why.'
    };
  }
  return {
    mode: 'THREE_OPTIONS',
    reason: 'big_or_risky',
    options: normalizeOptions(options),
    message: 'Give Founder Sir 3 options and wait for choice.'
  };
}

function mergePolicy(risk = 'LOW') {
  const normalizedRisk = String(risk || 'LOW').toUpperCase();
  if (normalizedRisk === 'LOW') {
    return {
      mode: 'AUTO_MERGE',
      allowed: true,
      reason: 'low_risk_safe_scope_only'
    };
  }
  return {
    mode: 'PR_REVIEW_REQUIRED',
    allowed: false,
    reason: 'high_risk_founder_eyes_first'
  };
}

function topThreeRisks(state = {}) {
  const sections = state.sections || {};
  return [
    ...array(sections.risks),
    ...array(sections.unresolved),
    ...array(sections.approvals)
  ].filter(Boolean).slice(0, 3);
}

function immediateAlerts(state = {}) {
  const sections = state.sections || {};
  return [
    ...array(sections.risks),
    ...array(sections.unresolved),
    ...array(sections.repeatedFailures),
    ...array(sections.approvals)
  ].filter((item) => item && !/^no\s/i.test(String(item))).map((item) => ({
    risk: item,
    alert: 'IMMEDIATE',
    reason: 'above_zero_risk_no_filter'
  }));
}

function schoolModeDigest(state = {}) {
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  const momentum = state.momentum || 'UNKNOWN';
  const risks = topThreeRisks(state);
  return [
    'Founder Sir, 7am school mode CTO update.',
    `Health: ${health}. Momentum: ${momentum}.`,
    risks.length
      ? `Top risks: ${risks.map((risk) => compact(risk, 54)).join(' | ')}`
      : 'Top risks: none recorded.',
    'Inniku main work: maintain, watch risks, suggest useful features. Big move panna matten without you.'
  ].join('\n');
}

function groupChatDailyUpdate(state = {}) {
  const risks = topThreeRisks(state);
  const health = state.healthScore == null ? 'unknown' : `${state.healthScore}/100`;
  const momentum = state.momentum || 'UNKNOWN';
  return [
    '🎯 CTO: Starting daily scan da. Health ' + health + ', momentum ' + momentum + '.',
    `🔧 CODER: Checked build/state — ${state.sections && state.sections.completedFixes && state.sections.completedFixes.length ? 'work recorded' : 'no runtime fix recorded yet'}.`,
    `⚖️ REVIEWER: Top risks ${risks.length ? risks.length : 0}. ${risks[0] ? compact(risks[0], 58) : 'Nothing major listed.'}`,
    `🚨 AUDITOR: Immediate alert mode on — ${immediateAlerts(state).length} above-zero item(s).`,
    '🎯 CTO: Big move panna matten. Approval needed na I will ask with 3 options.'
  ].join('\n');
}

function normalizeOptions(options) {
  const defaults = [
    'Safest: pause and gather runtime evidence.',
    'Balanced: propose a small reversible patch.',
    'Risky: bigger change, founder approval required.'
  ];
  const clean = array(options).filter(Boolean).slice(0, 3);
  return [...clean, ...defaults].slice(0, 3);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value, max = 80) {
  const text = String(value || '').replace(/^\[[^\]]+\]\s*/, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  classifyDecision,
  mergePolicy,
  topThreeRisks,
  immediateAlerts,
  schoolModeDigest,
  groupChatDailyUpdate
};
