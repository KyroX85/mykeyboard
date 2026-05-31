function checkNotificationRateLimit(memory = {}, {
  priority = 'LOW',
  type = 'proactive',
  now = new Date()
} = {}) {
  if (priority === 'CRITICAL') return { allowed: true, reason: 'critical_bypass' };

  const notifications = Array.isArray(memory.notifications) ? memory.notifications : [];
  const today = dayKey(now);
  const sentToday = notifications.filter((item) =>
    item.sent !== false &&
    dayKey(new Date(item.timestamp || 0)) === today
  );

  if (type === 'normal_status') {
    const lastStatus = [...notifications]
      .reverse()
      .find((item) => item.type === 'normal_status' && item.sent !== false);
    if (lastStatus) {
      const elapsedHours = (now.getTime() - new Date(lastStatus.timestamp).getTime()) / 36e5;
      if (Number.isFinite(elapsedHours) && elapsedHours < 24) {
        return { allowed: false, reason: 'normal_status_24h_limit' };
      }
    }
  }

  const counts = countByPriority(sentToday);
  if (priority === 'HIGH' && counts.HIGH >= 3) return { allowed: false, reason: 'high_daily_limit' };
  if (priority === 'MEDIUM' && counts.MEDIUM >= 1) return { allowed: false, reason: 'medium_daily_limit' };
  if (priority === 'LOW') return { allowed: false, reason: 'low_proactive_blocked' };

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

module.exports = {
  checkNotificationRateLimit,
  countByPriority
};
