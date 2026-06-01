function checkNotificationRateLimit(memory = {}, {
  priority = 'LOW',
  type = 'proactive',
  now = new Date()
} = {}) {
  if (priority === 'CRITICAL') return { allowed: true, reason: 'critical_bypass' };

  const notifications = Array.isArray(memory.notifications) ? memory.notifications : [];

  if (priority === 'LOW') return { allowed: false, reason: 'low_proactive_blocked' };

  if (priority === 'MEDIUM' && !isDailyDigestType(type)) {
    return { allowed: false, reason: 'medium_digest_only' };
  }

  if (priority === 'HIGH') {
    const lastHigh = lastSentNotification(notifications, (item) =>
      String(item.priority || '').toUpperCase() === 'HIGH'
    );
    if (lastHigh && elapsedHours(now, lastHigh.timestamp) < 6) {
      return { allowed: false, reason: 'high_6h_limit' };
    }
  }

  if (priority === 'MEDIUM' || isDailyDigestType(type)) {
    const lastDigest = lastSentNotification(notifications, (item) =>
      isDailyDigestType(item.type) || String(item.priority || '').toUpperCase() === 'MEDIUM'
    );
    if (lastDigest && elapsedHours(now, lastDigest.timestamp) < 24) {
      return { allowed: false, reason: 'daily_digest_24h_limit' };
    }
  }

  return { allowed: true, reason: 'within_limit' };
}

function countByPriority(items = []) {
  return items.reduce((accumulator, item) => {
    const priority = String(item.priority || 'LOW').toUpperCase();
    accumulator[priority] = (accumulator[priority] || 0) + 1;
    return accumulator;
  }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function lastSentNotification(notifications = [], predicate = () => true) {
  return [...notifications]
    .reverse()
    .find((item) => item.sent !== false && predicate(item));
}

function elapsedHours(now = new Date(), timestamp = null) {
  const then = new Date(timestamp || 0);
  const hours = (now.getTime() - then.getTime()) / 36e5;
  return Number.isFinite(hours) ? hours : Infinity;
}

function isDailyDigestType(type = '') {
  return ['daily_digest', 'normal_status', 'school_mode_digest'].includes(String(type || ''));
}

module.exports = {
  checkNotificationRateLimit,
  countByPriority,
  elapsedHours,
  isDailyDigestType
};
