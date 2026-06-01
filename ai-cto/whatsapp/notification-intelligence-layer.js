const {
  readNotificationMemory,
  recordNotification,
  summarizeBody
} = require('./notification-memory');
const { checkNotificationDuplicate } = require('./notification-deduplication-engine');
const { classifyNotificationPriority } = require('./notification-priority-engine');
const { checkNotificationRateLimit } = require('./notification-rate-limiter');
const { runNotificationSelfCheck } = require('./notification-self-check');

function evaluateProactiveNotification({
  root = process.cwd(),
  type = 'proactive',
  body = '',
  state = {},
  now = new Date(),
  priorityOverride = null,
  reason = ''
} = {}) {
  const memory = readNotificationMemory(root);
  const priorityResult = priorityOverride
    ? { priority: priorityOverride, reason: reason || 'explicit priority override', evidence: [], interruptAllowed: priorityOverride !== 'LOW' }
    : classifyNotificationPriority({
      type,
      body,
      state,
      now,
      founderLastSeenAt: memory.founderActivity && memory.founderActivity.lastSeenAt
    });
  const dedupe = checkNotificationDuplicate(body, memory, { now });
  const rateLimit = checkNotificationRateLimit(memory, {
    priority: priorityResult.priority,
    type,
    now
  });
  const selfCheck = runNotificationSelfCheck({
    body,
    priority: priorityResult.priority,
    type,
    evidence: priorityResult.evidence,
    dedupe,
    rateLimit
  });

  const decision = {
    allowed: selfCheck.allowed,
    reason: selfCheck.allowed ? 'send_allowed' : selfCheck.reason,
    type,
    priority: priorityResult.priority,
    summary: summarizeBody(body),
    summaryHash: dedupe.summaryHash,
    priorityReason: priorityResult.reason,
    evidence: priorityResult.evidence,
    dedupe,
    rateLimit,
    selfCheck
  };

  return decision;
}

function recordNotificationDecision(root = process.cwd(), decision = {}, {
  body = '',
  now = new Date(),
  sent = true
} = {}) {
  return recordNotification(root, {
    now,
    type: decision.type,
    priority: decision.priority,
    body,
    summary: decision.summary,
    summaryHash: decision.summaryHash,
    reason: decision.priorityReason || decision.reason,
    sent
  });
}

function insufficientEvidenceMessage() {
  return 'Insufficient evidence to score health.';
}

module.exports = {
  evaluateProactiveNotification,
  insufficientEvidenceMessage,
  recordNotificationDecision
};
