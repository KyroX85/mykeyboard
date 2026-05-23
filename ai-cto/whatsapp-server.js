const crypto = require('crypto');
const express = require('express');
const { routeMessageWithAi } = require('./whatsapp/command-router');
const { loadEngineeringState } = require('./whatsapp/state-reader');
const { updateMemory, readConversationMemory, updateConversationMemory } = require('./whatsapp/memory-store');
const { logWebhookEvent } = require('./whatsapp/webhook-log');
const { createOperationalGuard } = require('./whatsapp/operational-guard');
const { startupSelfCheck, workflowFreshness } = require('./whatsapp/diagnostics');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const FOUNDER_WHATSAPP_NUMBER = normalizePhone(process.env.FOUNDER_WHATSAPP_NUMBER || '');
const ALLOW_UNVERIFIED_WHATSAPP = process.env.ALLOW_UNVERIFIED_WHATSAPP === 'true';
const STARTED_AT = new Date().toISOString();
const guard = createOperationalGuard();

function normalizePhone(value) {
  return String(value || '').replace(/^whatsapp:/i, '').replace(/\s+/g, '');
}

function twiml(message) {
  return twimlMessages(chunkMessage(message));
}

function twimlMessages(messages) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    ...messages.map((message) => `<Message>${escapeXml(message)}</Message>`),
    '</Response>'
  ].join('');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chunkMessage(message, maxLength = 1400) {
  const text = String(message || '');
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < Math.floor(maxLength * 0.6)) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < Math.floor(maxLength * 0.6)) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.map((chunk, index) => {
    if (chunks.length === 1) return chunk;
    return `Part ${index + 1}/${chunks.length}\n${chunk}`;
  });
}

function requestUrl(req) {
  if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL.replace(/\/$/, '')}${req.originalUrl}`;
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

function validateTwilioSignature(req) {
  if (!TWILIO_AUTH_TOKEN) return ALLOW_UNVERIFIED_WHATSAPP;

  const provided = req.get('X-Twilio-Signature') || '';
  if (!provided) return false;

  const params = req.body || {};
  const data = Object.keys(params)
    .sort()
    .reduce((accumulator, key) => `${accumulator}${key}${params[key]}`, requestUrl(req));

  const expected = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(Buffer.from(data, 'utf8'))
    .digest('base64');

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return null;
  if (!TWILIO_AUTH_TOKEN && !ALLOW_UNVERIFIED_WHATSAPP) return 'TWILIO_AUTH_TOKEN is required in production.';
  if (!FOUNDER_WHATSAPP_NUMBER) return 'FOUNDER_WHATSAPP_NUMBER is required in production.';
  return null;
}

function requestId() {
  return crypto.randomBytes(8).toString('hex');
}

function extractTwilioBody(req) {
  const parsed = req && req.body && typeof req.body === 'object' ? req.body : {};
  return {
    rawType: typeof (req ? req.body : undefined),
    parsed,
    from: normalizePhone(parsed.From || ''),
    body: typeof parsed.Body === 'string' ? parsed.Body : '',
    messageSid: parsed.MessageSid || parsed.SmsMessageSid || ''
  };
}

function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.urlencoded({ extended: false }));

  app.get('/healthz', (req, res) => {
    const configError = assertProductionConfig();
    const state = loadEngineeringState();
    const freshness = workflowFreshness(state);
    const diagnostics = startupSelfCheck({
      nodeEnv: process.env.NODE_ENV,
      twilioAuthToken: TWILIO_AUTH_TOKEN,
      allowUnverified: ALLOW_UNVERIFIED_WHATSAPP,
      founderNumber: FOUNDER_WHATSAPP_NUMBER
    });
    res.status(configError ? 503 : 200).json({
      ok: !configError && diagnostics.ok,
      service: 'aritenis-ai-cto-whatsapp',
      startedAt: STARTED_AT,
      configError,
      workflowFreshness: freshness,
      diagnostics
    });
  });

  app.get('/system-health', (req, res) => {
    const state = loadEngineeringState();
    const diagnostics = startupSelfCheck({
      nodeEnv: process.env.NODE_ENV,
      twilioAuthToken: TWILIO_AUTH_TOKEN,
      allowUnverified: ALLOW_UNVERIFIED_WHATSAPP,
      founderNumber: FOUNDER_WHATSAPP_NUMBER
    });
    res.status(diagnostics.ok ? 200 : 503).json({
      ok: diagnostics.ok,
      service: 'aritenis-ai-cto-whatsapp',
      startedAt: STARTED_AT,
      guard: guard.settings,
      workflowFreshness: workflowFreshness(state),
      diagnostics
    });
  });

  app.post('/twilio/whatsapp', async (req, res) => {
    const startedAt = Date.now();
    const id = requestId();
    const incoming = extractTwilioBody(req);
    const from = incoming.from;
    const body = incoming.body;
    const messageSid = incoming.messageSid;

    const configError = assertProductionConfig();
    if (configError) {
      logWebhookEvent({ type: 'config_error', requestId: id, from, body, status: 503, error: configError });
      res.status(503).type('text/xml').send(twiml(`Founder Sir, CTO WhatsApp is not configured: ${configError}`));
      return;
    }

    if (guard.isAbusive(from)) {
      logWebhookEvent({ type: 'abuse_blocked', requestId: id, from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }

    if (!validateTwilioSignature(req)) {
      guard.recordAbuse(from, 'bad_signature');
      logWebhookEvent({ type: 'signature_rejected', requestId: id, from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }

    if (FOUNDER_WHATSAPP_NUMBER && from !== FOUNDER_WHATSAPP_NUMBER) {
      guard.recordAbuse(from, 'bad_sender');
      logWebhookEvent({ type: 'sender_rejected', requestId: id, from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }

    const replay = guard.checkReplay(messageSid);
    if (replay.replayed) {
      logWebhookEvent({ type: 'replay_rejected', requestId: id, from, body, status: 409, meta: { messageSid } });
      res.status(409).type('text/xml').send(twiml('Founder Sir, duplicate webhook delivery ignored.'));
      return;
    }

    const rate = guard.checkRateLimit(from);
    if (rate.limited) {
      logWebhookEvent({ type: 'rate_limited', requestId: id, from, body, status: 429, meta: { count: rate.count } });
      res.status(429).type('text/xml').send(twiml('Founder Sir, rate limit reached. Try again shortly.'));
      return;
    }

    try {
      const state = loadEngineeringState();
      state.workflowFreshness = workflowFreshness(state);
      const memory = readConversationMemory();
      const routed = await routeMessageWithAi(body, state, memory, {
        commit: process.env.CTO_AI_EXECUTION_COMMIT === 'true',
        push: process.env.CTO_AI_EXECUTION_PUSH === 'true'
      });
      const cooldownKey = routed.command === 'agent'
        ? `agent:${routed.agent}:${routed.intent}`
        : routed.command;
      const cooldown = guard.checkCommandCooldown(from, cooldownKey);
      if (cooldown.coolingDown) {
        logWebhookEvent({ type: 'command_cooldown', requestId: id, from, body, command: routed.command, status: 429 });
        res.status(429).type('text/xml').send(twiml('Founder Sir, command cooldown is active. Try again in a few seconds.'));
        return;
      }
      if (routed.command === 'agent') {
        updateConversationMemory(routed.details, state);
      } else {
        updateMemory(routed.command, state, routed.details);
      }
      logWebhookEvent({
        type: 'reply',
        requestId: id,
        from,
        body,
        command: routed.command,
        status: 200,
        durationMs: Date.now() - startedAt
        ,
        meta: {
          rawBodyType: incoming.rawType,
          parsedKeys: Object.keys(incoming.parsed),
          matchedRoute: routed.matchedRoute || routed.command,
          fallbackReason: routed.details ? routed.details.fallbackReason : null
        }
      });
      res.status(200).type('text/xml').send(twiml(routed.response));
    } catch (error) {
      logWebhookEvent({
        type: 'handler_error',
        requestId: id,
        from,
        body,
        status: 500,
        durationMs: Date.now() - startedAt,
        error: error.message
      });
      res.status(200).type('text/xml').send(twiml('Founder Sir, CTO status is temporarily unavailable. The reporting worker is still independent and will continue on schedule.'));
    }
  });

  return app;
}

if (require.main === module) {
  const diagnostics = startupSelfCheck({
    nodeEnv: process.env.NODE_ENV,
    twilioAuthToken: TWILIO_AUTH_TOKEN,
    allowUnverified: ALLOW_UNVERIFIED_WHATSAPP,
    founderNumber: FOUNDER_WHATSAPP_NUMBER
  });
  console.log(`[whatsapp-cto] startup self-check ok=${diagnostics.ok}`);
  createApp().listen(PORT, () => {
    console.log(`[whatsapp-cto] listening on port ${PORT}`);
  });
}

module.exports = {
  createApp,
  validateTwilioSignature,
  twiml,
  twimlMessages,
  chunkMessage,
  normalizePhone,
  extractTwilioBody
};
