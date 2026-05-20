const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROUTING_DEBUG_FILE = path.join(ROOT, 'ai-cto', 'routing-debug.log');
const MAX_LOG_BYTES = 256 * 1024;

function logRoutingDecision(event) {
  rotateIfNeeded();
  const entry = {
    at: new Date().toISOString(),
    incoming: safeText(event.incoming),
    normalized: safeText(event.normalized),
    detectedAgent: event.detectedAgent || null,
    intent: event.intent || null,
    confidence: typeof event.confidence === 'number' ? event.confidence : null,
    matchedRoute: event.matchedRoute || null,
    fallbackUsed: Boolean(event.fallbackUsed),
    fallbackReason: event.fallbackReason || null
  };

  try {
    fs.appendFileSync(ROUTING_DEBUG_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    // Debug logging must never block WhatsApp replies.
  }
}

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(ROUTING_DEBUG_FILE)) return;
    if (fs.statSync(ROUTING_DEBUG_FILE).size <= MAX_LOG_BYTES) return;
    const rotated = `${ROUTING_DEBUG_FILE}.1`;
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(ROUTING_DEBUG_FILE, rotated);
  } catch {
    // Best effort only.
  }
}

module.exports = {
  ROUTING_DEBUG_FILE,
  logRoutingDecision
};
