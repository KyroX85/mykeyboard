const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG_FILE = path.join(ROOT, 'ai-cto', 'whatsapp-webhook.log');

function safeText(value, limit = 160) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function logWebhookEvent(event) {
  const entry = {
    at: new Date().toISOString(),
    type: event.type || 'event',
    from: event.from ? maskPhone(event.from) : null,
    command: event.command || null,
    body: event.body ? safeText(event.body) : null,
    status: event.status || null,
    error: event.error ? safeText(event.error, 240) : null
  };

  try {
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    // Logging must never block WhatsApp replies.
  }
}

function maskPhone(phone) {
  const value = String(phone || '');
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

module.exports = {
  logWebhookEvent,
  LOG_FILE
};
