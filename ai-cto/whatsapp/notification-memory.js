const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_MEMORY = {
  version: '1.0',
  notifications: [],
  founderActivity: {
    lastSeenAt: null,
    absenceStage: 'NONE'
  }
};

function notificationMemoryPath(root = process.cwd()) {
  return process.env.ARITENIS_NOTIFICATION_MEMORY_FILE ||
    path.join(root, 'ai-cto', '.notification-memory.json');
}

function readNotificationMemory(root = process.cwd()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(notificationMemoryPath(root), 'utf8'));
    return {
      ...DEFAULT_MEMORY,
      ...parsed,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : []
    };
  } catch {
    return { ...DEFAULT_MEMORY, notifications: [] };
  }
}

function writeNotificationMemory(root = process.cwd(), memory = DEFAULT_MEMORY) {
  const file = notificationMemoryPath(root);
  const next = {
    ...DEFAULT_MEMORY,
    ...memory,
    notifications: Array.isArray(memory.notifications)
      ? memory.notifications.slice(-200)
      : []
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
}

function recordNotification(root = process.cwd(), notification = {}) {
  const memory = readNotificationMemory(root);
  const body = String(notification.body || notification.summary || '');
  const entry = {
    timestamp: (notification.now || new Date()).toISOString(),
    type: notification.type || 'unknown',
    priority: notification.priority || 'LOW',
    summary: notification.summary || summarizeBody(body),
    summaryHash: notification.summaryHash || hashSummary(body),
    reason: notification.reason || '',
    sent: notification.sent !== false
  };
  return writeNotificationMemory(root, {
    ...memory,
    notifications: [...memory.notifications, entry].slice(-200)
  });
}

function updateFounderActivity(root = process.cwd(), lastSeenAt = new Date()) {
  const memory = readNotificationMemory(root);
  return writeNotificationMemory(root, {
    ...memory,
    founderActivity: {
      ...(memory.founderActivity || {}),
      lastSeenAt: new Date(lastSeenAt).toISOString()
    }
  });
}

function hashSummary(value = '') {
  return crypto
    .createHash('sha256')
    .update(normalizeForHash(value))
    .digest('hex')
    .slice(0, 16);
}

function summarizeBody(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function normalizeForHash(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[0-9a-f]{7,40}/g, '<hash>')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '<time>')
    .replace(/\d{4}-\d{2}-\d{2}/g, '<date>')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  DEFAULT_MEMORY,
  hashSummary,
  notificationMemoryPath,
  readNotificationMemory,
  recordNotification,
  summarizeBody,
  updateFounderActivity,
  writeNotificationMemory
};
