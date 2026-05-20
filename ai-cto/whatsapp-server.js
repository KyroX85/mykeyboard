const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const { routeMessage } = require('./whatsapp/command-router');
const { loadEngineeringState } = require('./whatsapp/state-reader');
const { readMemory, updateMemory } = require('./whatsapp/memory-store');
const { logWebhookEvent } = require('./whatsapp/webhook-log');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const FOUNDER_WHATSAPP_NUMBER = normalizePhone(process.env.FOUNDER_WHATSAPP_NUMBER || '');
const ALLOW_UNVERIFIED_WHATSAPP = process.env.ALLOW_UNVERIFIED_WHATSAPP === 'true';
const RATE_LIMIT_WINDOW_MS = Number(process.env.WHATSAPP_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.WHATSAPP_RATE_LIMIT_MAX || 12);
const rateBuckets = new Map();

function normalizePhone(value) {
  return String(value || '').replace(/^whatsapp:/i, '').replace(/\s+/g, '');
}

function twiml(message) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Message>${escapeXml(message)}</Message>`,
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

function isRateLimited(sender) {
  const key = sender || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(bodyParser.urlencoded({ extended: false }));

  app.get('/healthz', (req, res) => {
    const configError = assertProductionConfig();
    res.status(configError ? 503 : 200).json({
      ok: !configError,
      service: 'aritenis-ai-cto-whatsapp',
      configError
    });
  });

  app.post('/twilio/whatsapp', (req, res) => {
    const from = normalizePhone(req.body.From);
    const body = req.body.Body || '';

    const configError = assertProductionConfig();
    if (configError) {
      logWebhookEvent({ type: 'config_error', from, body, status: 503, error: configError });
      res.status(503).type('text/xml').send(twiml(`Founder Sir, CTO WhatsApp is not configured: ${configError}`));
      return;
    }

    if (!validateTwilioSignature(req)) {
      logWebhookEvent({ type: 'signature_rejected', from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }

    if (FOUNDER_WHATSAPP_NUMBER && from !== FOUNDER_WHATSAPP_NUMBER) {
      logWebhookEvent({ type: 'sender_rejected', from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }

    if (isRateLimited(from)) {
      logWebhookEvent({ type: 'rate_limited', from, body, status: 429 });
      res.status(429).type('text/xml').send(twiml('Founder Sir, rate limit reached. Try again shortly.'));
      return;
    }

    try {
      const state = loadEngineeringState();
      const memory = readMemory();
      const routed = routeMessage(body, state, memory);
      updateMemory(routed.command, state, routed.details);
      logWebhookEvent({ type: 'reply', from, body, command: routed.command, status: 200 });
      res.status(200).type('text/xml').send(twiml(routed.response));
    } catch (error) {
      logWebhookEvent({ type: 'handler_error', from, body, status: 500, error: error.message });
      res.status(200).type('text/xml').send(twiml('Founder Sir, CTO status is temporarily unavailable. The reporting worker is still independent and will continue on schedule.'));
    }
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`[whatsapp-cto] listening on port ${PORT}`);
  });
}

module.exports = {
  createApp,
  validateTwilioSignature,
  twiml,
  normalizePhone
};
