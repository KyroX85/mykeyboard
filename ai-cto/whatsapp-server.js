const crypto = require('crypto');
const express = require('express');
const { routeMessageWithAi } = require('./whatsapp/command-router');
const { loadEngineeringState } = require('./whatsapp/state-reader');
const { updateMemory, readConversationMemory, updateConversationMemory } = require('./whatsapp/memory-store');
const { logWebhookEvent } = require('./whatsapp/webhook-log');
const { createOperationalGuard } = require('./whatsapp/operational-guard');
const { startupSelfCheck, workflowFreshness } = require('./whatsapp/diagnostics');
const { executeVisionCommandEntry, formatVisionApprovalResult } = require('./whatsapp/vision-command-manager');
const {
  rememberFounderInteraction,
  maybeCommitFounderMemory
} = require('./whatsapp/founder-memory');
const { execFileSync } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const FOUNDER_WHATSAPP_NUMBER = normalizePhone(process.env.FOUNDER_WHATSAPP_NUMBER || '');
const ALLOW_UNVERIFIED_WHATSAPP = process.env.ALLOW_UNVERIFIED_WHATSAPP === 'true';
const STARTED_AT = new Date().toISOString();
const guard = createOperationalGuard();

function startupExecutionDiagnostics(root = process.cwd()) {
  const gitAvailable = (() => {
    try {
      return execFileSync('git', ['--version'], { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
    } catch {
      return 'missing';
    }
  })();
  return {
    githubToken: process.env.GITHUB_TOKEN ? 'present' : 'missing',
    commit: process.env.CTO_AI_EXECUTION_COMMIT !== 'false',
    push: process.env.CTO_AI_EXECUTION_PUSH !== 'false',
    git: gitAvailable
  };
}

function logStartupExecutionDiagnostics() {
  const diagnostics = startupExecutionDiagnostics();
  console.log(`[whatsapp-cto] GITHUB_TOKEN: ${diagnostics.githubToken}`);
  console.log(`[whatsapp-cto] CTO_AI_EXECUTION_COMMIT: ${diagnostics.commit}`);
  console.log(`[whatsapp-cto] CTO_AI_EXECUTION_PUSH: ${diagnostics.push}`);
  console.log(`[whatsapp-cto] GIT: ${diagnostics.git}`);
}

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

function signatureUrlCandidates(req) {
  const path = req.originalUrl || req.url || '/twilio/whatsapp';
  const host = req.get('host');
  const forwardedProto = req.get('x-forwarded-proto');
  const candidates = new Set();

  if (PUBLIC_BASE_URL) candidates.add(`${PUBLIC_BASE_URL.replace(/\/$/, '')}${path}`);
  if (host) {
    candidates.add(`${req.protocol}://${host}${path}`);
    candidates.add(`https://${host}${path}`);
    if (forwardedProto) candidates.add(`${String(forwardedProto).split(',')[0].trim()}://${host}${path}`);
  }

  return [...candidates].filter(Boolean);
}

function expectedTwilioSignature(url, params) {
  const data = Object.keys(params)
    .sort()
    .reduce((accumulator, key) => `${accumulator}${key}${params[key]}`, url);

  return crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(Buffer.from(data, 'utf8'))
    .digest('base64');
}

function validateTwilioSignature(req) {
  return checkTwilioSignature(req).valid;
}

function checkTwilioSignature(req) {
  const provided = req.get('X-Twilio-Signature') || '';
  const candidates = signatureUrlCandidates(req);
  const debug = {
    hasAuthToken: Boolean(TWILIO_AUTH_TOKEN),
    allowUnverified: ALLOW_UNVERIFIED_WHATSAPP,
    hasProvidedSignature: Boolean(provided),
    candidateCount: candidates.length,
    candidateUrls: candidates
  };
  if (!TWILIO_AUTH_TOKEN) return { valid: ALLOW_UNVERIFIED_WHATSAPP, ...debug };
  if (!provided) return { valid: false, ...debug };

  const params = req.body || {};
  const providedBuffer = Buffer.from(provided);

  const matchedUrl = candidates.find((url) => {
    const expectedBuffer = Buffer.from(expectedTwilioSignature(url, params));
    return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  });
  return { valid: Boolean(matchedUrl), matchedUrl: matchedUrl || null, ...debug };
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
    messageSid: parsed.MessageSid || parsed.SmsMessageSid || '',
    to: parsed.To || '',
    accountSid: parsed.AccountSid || ''
  };
}

function isFastGreeting(body) {
  return /^(hi|hello|hey|sup|bro|yo|good morning|good evening)$/i.test(String(body || '').trim());
}

function fastGreetingReply() {
  return [
    'CTO: Founder, team is online.',
    'CODER: Ready.',
    'REVIEWER: Standing by.',
    'AUDITOR: Monitoring active.'
  ].join('\n');
}

function logVisibleWebhook(stage, details = {}) {
  const safe = {
    requestId: details.requestId || null,
    from: details.from ? maskPhoneForConsole(details.from) : null,
    body: details.body ? String(details.body).replace(/\s+/g, ' ').slice(0, 120) : null,
    command: details.command || null,
    status: details.status || null,
    reason: details.reason || null,
    durationMs: Number.isFinite(details.durationMs) ? details.durationMs : undefined,
    meta: details.meta && typeof details.meta === 'object' ? details.meta : undefined,
    parsedKeys: Array.isArray(details.parsedKeys) ? details.parsedKeys : undefined
  };
  console.log(`[whatsapp-cto] WEBHOOK ${stage}: ${JSON.stringify(safe)}`);
}

function maskPhoneForConsole(phone) {
  const value = String(phone || '');
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
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

  app.get('/health', (req, res) => {
    res.redirect(307, '/healthz');
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
    res.on('finish', () => {
      logVisibleWebhook('http_finished', {
        requestId: id,
        from,
        body,
        status: res.statusCode,
        reason: 'response_closed',
        durationMs: Date.now() - startedAt
      });
    });
    logVisibleWebhook('received', {
      requestId: id,
      from,
      body,
      parsedKeys: Object.keys(incoming.parsed)
    });

    const configError = assertProductionConfig();
    if (configError) {
      logVisibleWebhook('config_error', { requestId: id, from, body, status: 503, reason: configError });
      logWebhookEvent({ type: 'config_error', requestId: id, from, body, status: 503, error: configError });
      res.status(503).type('text/xml').send(twiml(`Founder, CTO WhatsApp is not configured: ${configError}`));
      return;
    }
    logVisibleWebhook('config_ok', { requestId: id, from, body, status: 200 });

    if (guard.isAbusive(from)) {
      logVisibleWebhook('abuse_blocked', { requestId: id, from, body, status: 403 });
      logWebhookEvent({ type: 'abuse_blocked', requestId: id, from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }
    logVisibleWebhook('abuse_check_ok', { requestId: id, from, body, status: 200 });

    const signature = checkTwilioSignature(req);
    logVisibleWebhook('signature_checked', {
      requestId: id,
      from,
      body,
      status: signature.valid ? 200 : 403,
      reason: signature.valid ? 'valid' : 'invalid',
      meta: {
        hasProvidedSignature: signature.hasProvidedSignature,
        candidateCount: signature.candidateCount,
        matchedUrl: signature.matchedUrl || null,
        candidateUrls: signature.candidateUrls
      }
    });
    if (!signature.valid) {
      guard.recordAbuse(from, 'bad_signature');
      logVisibleWebhook('signature_rejected', { requestId: id, from, body, status: 403 });
      logWebhookEvent({ type: 'signature_rejected', requestId: id, from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }

    if (FOUNDER_WHATSAPP_NUMBER && from !== FOUNDER_WHATSAPP_NUMBER) {
      guard.recordAbuse(from, 'bad_sender');
      logVisibleWebhook('sender_rejected', { requestId: id, from, body, status: 403 });
      logWebhookEvent({ type: 'sender_rejected', requestId: id, from, body, status: 403 });
      res.status(403).type('text/xml').send(twiml('Access denied.'));
      return;
    }
    logVisibleWebhook('sender_check_ok', { requestId: id, from, body, status: 200 });

    const replay = guard.checkReplay(messageSid);
    logVisibleWebhook('replay_checked', {
      requestId: id,
      from,
      body,
      status: replay.replayed ? 409 : 200,
      reason: replay.replayed ? 'duplicate_message_sid' : 'fresh_message',
      meta: { messageSidPresent: Boolean(messageSid) }
    });
    if (replay.replayed) {
      logVisibleWebhook('replay_rejected', { requestId: id, from, body, status: 409 });
      logWebhookEvent({ type: 'replay_rejected', requestId: id, from, body, status: 409, meta: { messageSid } });
      res.status(409).type('text/xml').send(twiml('Founder, duplicate webhook delivery ignored.'));
      return;
    }

    const rate = guard.checkRateLimit(from);
    logVisibleWebhook('rate_checked', {
      requestId: id,
      from,
      body,
      status: rate.limited ? 429 : 200,
      reason: `count=${rate.count}`,
      meta: { retryAfterMs: rate.retryAfterMs }
    });
    if (rate.limited) {
      logVisibleWebhook('rate_limited', { requestId: id, from, body, status: 429, reason: `count=${rate.count}` });
      logWebhookEvent({ type: 'rate_limited', requestId: id, from, body, status: 429, meta: { count: rate.count } });
      res.status(429).type('text/xml').send(twiml('Founder, rate limit reached. Try again shortly.'));
      return;
    }

    if (isFastGreeting(body)) {
      logVisibleWebhook('fast_reply', {
        requestId: id,
        from,
        body,
        command: 'fast_greeting',
        status: 200,
        reason: 'server_fast_path'
      });
      logWebhookEvent({
        type: 'fast_reply',
        requestId: id,
        from,
        body,
        command: 'fast_greeting',
        status: 200,
        durationMs: Date.now() - startedAt,
        meta: { matchedRoute: 'server_fast_greeting' }
      });
      res.status(200).type('text/xml').send(twiml(fastGreetingReply()));
      return;
    }

    try {
      logVisibleWebhook('router_start', { requestId: id, from, body, status: 200 });
      const state = loadEngineeringState();
      state.workflowFreshness = workflowFreshness(state);
      const memory = readConversationMemory();
      const routed = await routeMessageWithAi(body, state, memory, {
        commit: process.env.CTO_AI_EXECUTION_COMMIT !== 'false',
        push: process.env.CTO_AI_EXECUTION_PUSH !== 'false',
        deferLowRiskVisionExecution: true
      });
      logVisibleWebhook('routed', {
        requestId: id,
        from,
        body,
        command: routed.command,
        status: 200,
        reason: routed.matchedRoute || routed.command
      });
      const cooldownKey = routed.command === 'agent'
        ? `agent:${routed.agent}:${routed.intent}`
        : routed.command;
      const cooldown = guard.checkCommandCooldown(from, cooldownKey);
      if (cooldown.coolingDown) {
        logVisibleWebhook('command_cooldown', { requestId: id, from, body, command: routed.command, status: 429 });
        logWebhookEvent({ type: 'command_cooldown', requestId: id, from, body, command: routed.command, status: 429 });
        res.status(429).type('text/xml').send(twiml('Founder, command cooldown is active. Try again in a few seconds.'));
        return;
      }
      if (routed.command === 'agent') {
        updateConversationMemory(routed.details, state);
      } else {
        updateMemory(routed.command, state, routed.details);
      }
      rememberFounderInteraction({
        founderMessage: body,
        agentDecision: routed.command,
        executed: /execution|approved/i.test(routed.command),
        outcome: routed.response,
        commitHash: routed.details && routed.details.visionCommand && routed.details.visionCommand.commitHash
      });
      try {
        const memoryCommit = maybeCommitFounderMemory({
          push: process.env.CTO_AI_EXECUTION_PUSH !== 'false',
          enabled: process.env.CTO_MEMORY_AUTO_COMMIT !== 'false',
          force: routed.command === 'vision_command_auto_executed' ||
            routed.command === 'vision_command_approval_required' ||
            routed.command === 'vision_command_approved'
        });
        if (memoryCommit.committed) {
          console.log(`[whatsapp-cto] founder memory committed: ${memoryCommit.hash}`);
        }
      } catch (memoryError) {
        console.log(`[whatsapp-cto] founder memory commit skipped: ${memoryError.message}`);
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
      logVisibleWebhook('twiml_send', {
        requestId: id,
        from,
        body,
        command: routed.command,
        status: 200,
        reason: 'sending_webhook_response',
        durationMs: Date.now() - startedAt
      });
      logVisibleWebhook('reply', { requestId: id, from, body, command: routed.command, status: 200 });
      res.status(200).type('text/xml').send(twiml(routed.response));
      if (routed.command === 'vision_command_execution_started') {
        runDeferredVisionExecution({
          requestId: id,
          entry: routed.details && routed.details.visionCommand,
          incoming
        });
      }
    } catch (error) {
      console.log(`[whatsapp-cto] HANDLER ERROR requestId=${id} message=${error.message}`);
      if (error && error.stack) {
        console.log(`[whatsapp-cto] HANDLER ERROR STACK requestId=${id}\n${error.stack}`);
      }
      logWebhookEvent({
        type: 'handler_error',
        requestId: id,
        from,
        body,
        status: 500,
        durationMs: Date.now() - startedAt,
        error: error.message
      });
      res.status(200).type('text/xml').send(twiml('Founder, CTO status is temporarily unavailable. The reporting worker is still independent and will continue on schedule.'));
    }
  });

  return app;
}

function runDeferredVisionExecution({ requestId, entry, incoming }) {
  if (!entry) return;
  setImmediate(async () => {
    try {
      logVisibleWebhook('deferred_execution_started', {
        requestId,
        from: incoming.from,
        body: entry.command,
        command: 'vision_command_execution_started',
        status: 202
      });
      const completed = await executeVisionCommandEntry(entry, {
        commit: process.env.CTO_AI_EXECUTION_COMMIT !== 'false',
        push: process.env.CTO_AI_EXECUTION_PUSH !== 'false'
      });
      const message = formatVisionApprovalResult(completed);
      await sendTwilioWhatsAppMessage({
        accountSid: incoming.accountSid,
        from: incoming.to,
        to: `whatsapp:${incoming.from}`,
        body: message
      });
      logVisibleWebhook('deferred_execution_reply', {
        requestId,
        from: incoming.from,
        body: entry.command,
        command: 'vision_command_auto_executed',
        status: 200
      });
    } catch (error) {
      console.log(`[whatsapp-cto] DEFERRED EXECUTION ERROR requestId=${requestId} message=${error.message}`);
      await sendTwilioWhatsAppMessage({
        accountSid: incoming.accountSid,
        from: incoming.to,
        to: `whatsapp:${incoming.from}`,
        body: [
          'CODER: Could not complete this safely, Founder.',
          'Result: DEFERRED_EXECUTION_FAILED',
          `Reason: ${error.message}`
        ].join('\n')
      }).catch((sendError) => {
        console.log(`[whatsapp-cto] DEFERRED EXECUTION SEND FAILED requestId=${requestId} message=${sendError.message}`);
      });
    }
  });
}

async function sendTwilioWhatsAppMessage({ accountSid, from, to, body }) {
  const sid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
  if (!sid) throw new Error('TWILIO_ACCOUNT_SID or inbound AccountSid is required for deferred WhatsApp replies.');
  if (!TWILIO_AUTH_TOKEN) throw new Error('TWILIO_AUTH_TOKEN is required for deferred WhatsApp replies.');
  if (!from || !to) throw new Error('Twilio From and To are required for deferred WhatsApp replies.');
  const params = new URLSearchParams();
  params.set('From', from);
  params.set('To', to);
  params.set('Body', body);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Twilio send failed ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

if (require.main === module) {
  const diagnostics = startupSelfCheck({
    nodeEnv: process.env.NODE_ENV,
    twilioAuthToken: TWILIO_AUTH_TOKEN,
    allowUnverified: ALLOW_UNVERIFIED_WHATSAPP,
    founderNumber: FOUNDER_WHATSAPP_NUMBER
  });
  console.log(`[whatsapp-cto] startup self-check ok=${diagnostics.ok}`);
  logStartupExecutionDiagnostics();
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
  extractTwilioBody,
  startupExecutionDiagnostics
};
