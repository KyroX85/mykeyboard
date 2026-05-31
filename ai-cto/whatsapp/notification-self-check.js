function runNotificationSelfCheck({
  body = '',
  priority = 'LOW',
  type = 'proactive',
  evidence = [],
  dedupe = {},
  rateLimit = {}
} = {}) {
  const answers = {
    isNew: !dedupe.duplicate,
    isUseful: priority !== 'LOW',
    evidenceAttached: Array.isArray(evidence) && evidence.length > 0,
    founderWouldCare: ['CRITICAL', 'HIGH'].includes(priority) ||
      (priority === 'MEDIUM' && type === 'normal_status'),
    metricsAreSourced: metricsAreSourced(body, evidence)
  };

  if (!answers.isNew) return block('duplicate', answers);
  if (!answers.isUseful) return block('not_useful', answers);
  if (!answers.evidenceAttached) return block('no_evidence', answers);
  if (!answers.founderWouldCare) return block('not_interrupt_worthy', answers);
  if (!answers.metricsAreSourced) return block('unsourced_metric_score', answers);
  if (rateLimit && rateLimit.allowed === false) return block(rateLimit.reason || 'rate_limited', answers);

  return {
    allowed: true,
    reason: 'self_check_passed',
    answers
  };
}

function metricsAreSourced(body = '', evidence = []) {
  const text = String(body || '');
  const mentionsScore = /\b(health|momentum|risk)\s*(score|:|\d)/i.test(text);
  if (!mentionsScore) return true;
  const hasSourceReasonCalculation = /Source:/i.test(text) && /Reason:/i.test(text) && /Calculation:/i.test(text);
  const hasHardEvidence = Array.isArray(evidence) && evidence.some((item) =>
    /build_failure|test_failure|deployment_failure|security_issue|approval_request|major_milestone/i.test(item.kind)
  );
  return hasSourceReasonCalculation || hasHardEvidence;
}

function block(reason, answers) {
  return {
    allowed: false,
    reason,
    answers
  };
}

module.exports = {
  metricsAreSourced,
  runNotificationSelfCheck
};
