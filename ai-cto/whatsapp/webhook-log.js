const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG_FILE = path.join(ROOT, 'ai-cto', 'whatsapp-webhook.log');
const MAX_LOG_BYTES = 512 * 1024;

function safeText(value, limit = 160) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function bodyLength(value) {
  return typeof value === 'string' ? value.length : 0;
}

function logWebhookEvent(event) {
  rotateLogIfNeeded();
  const entry = {
    at: new Date().toISOString(),
    type: event.type || 'event',
    requestId: event.requestId || null,
    from: event.from ? maskPhone(event.from) : null,
    command: event.command || null,
    bodyLength: bodyLength(event.body),
    status: event.status || null,
    durationMs: Number.isFinite(event.durationMs) ? event.durationMs : null,
    error: event.error ? safeText(event.error, 240) : null,
    meta: event.meta || null
  };

  try {
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    // Logging must never block WhatsApp replies.
  }
}

function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stat = fs.statSync(LOG_FILE);
    if (stat.size <= MAX_LOG_BYTES) return;
    const rotated = `${LOG_FILE}.1`;
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(LOG_FILE, rotated);
  } catch {
    // Logging is best-effort only.
  }
}

function maskPhone(phone) {
  const value = String(phone || '');
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

module.exports = {
  logWebhookEvent,
  LOG_FILE,
  rotateLogIfNeeded
};
