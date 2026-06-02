const crypto = require('crypto');
const path = require('path');
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
const { createMetricsIngestHandler } = require('./product-metrics-ingest');
const { execFileSync } = require('child_process');
const {
  buildTwilioMessageParams,
  sendWhatsAppMessageWithFallback
} = require('./whatsapp/whatsapp-provider');
const { fetchLatestProductLabScreenshot } = require('./whatsapp/product-lab-artifact-fetcher');
const {
  buildVisionStewardMessage,
  buildVisionStewardMessageWithModelCouncil,
} = require('./whatsapp/vision-steward');
const {
  evaluateProactiveNotification,
  recordNotificationDecision
} = require('./whatsapp/notification-intelligence-layer');
const { answerFounderBrainQuestion } = require('./founder-brain-api');
const { enforceMemoryPolicyOnResponse } = require('./memory-policy-enforcer');
const { enforceExecutionSchemaOnRoute } = require('./execution-schema-enforcer');

const PORT = Number(process.env.PORT || 3000);
const REPO_ROOT = process.env.ARITENIS_REPO_ROOT || process.cwd();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const META_WHATSAPP_VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
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

function phoneDigits(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function samePhoneNumber(a, b) {
  const left = phoneDigits(a);
  const right = phoneDigits(b);
  return Boolean(left && right && left === right);
}

function twiml(message, mediaUrls = []) {
  return twimlMessages(chunkMessage(message), mediaUrls);
}

function twimlMessages(messages, mediaUrls = []) {
  const media = (Array.isArray(mediaUrls) ? mediaUrls : [mediaUrls]).filter(Boolean);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    ...messages.map((message, index) => {
      const mediaXml = index === 0 ? media.map((url) => `<Media>${escapeXml(url)}</Media>`).join('') : '';
      return `<Message><Body>${escapeXml(message)}</Body>${mediaXml}</Message>`;
    }),
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
  const hasTwilio = Boolean(TWILIO_AUTH_TOKEN);
  const hasMeta = Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID);
  if (!hasTwilio && !hasMeta && !ALLOW_UNVERIFIED_WHATSAPP) {
    return 'Twilio or Meta WhatsApp credentials are required in production.';
  }
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

function verifyMetaChallenge(query = {}) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && META_WHATSAPP_VERIFY_TOKEN && token === META_WHATSAPP_VERIFY_TOKEN) {
    return { ok: true, challenge: String(challenge || '') };
  }
  return { ok: false, reason: META_WHATSAPP_VERIFY_TOKEN ? 'verify_token_mismatch' : 'verify_token_missing' };
}

function validateMetaSignature(req) {
  if (!META_APP_SECRET) return { valid: true, skipped: true, reason: 'META_APP_SECRET not configured' };
  const provided = req.get('X-Hub-Signature-256') || '';
  if (!provided.startsWith('sha256=')) return { valid: false, skipped: false, reason: 'signature_missing' };
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const expected = `sha256=${crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('hex')}`;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  const valid = providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  return { valid, skipped: false, reason: valid ? 'signature_valid' : 'signature_mismatch' };
}

function validateBrainApiAuth(req) {
  const token = process.env.BRAIN_API_TOKEN || '';
  if (!token) return { ok: false, reason: 'BRAIN_API_TOKEN is required' };
  const authorization = req.get('Authorization') || '';
  const expected = `Bearer ${token}`;
  const providedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  const ok = providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  return { ok, reason: ok ? 'valid' : 'invalid_token' };
}

function extractMetaMessages(body = {}) {
  const messages = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change && change.value && typeof change.value === 'object' ? change.value : {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const rawMessages = Array.isArray(value.messages) ? value.messages : [];
      const metadata = value.metadata || {};
      for (const message of rawMessages) {
        const from = normalizePhone(message.from || (contacts[0] && contacts[0].wa_id) || '');
        const text = message.text && typeof message.text.body === 'string' ? message.text.body : '';
        messages.push({
          rawType: typeof body,
          parsed: body,
          from,
          body: text,
          messageSid: message.id || '',
          to: metadata.display_phone_number ? normalizePhone(metadata.display_phone_number) : '',
          phoneNumberId: metadata.phone_number_id || '',
          accountSid: '',
          provider: 'meta'
        });
      }
    }
  }
  return messages.filter((message) => message.from && message.body);
}

function isFastGreeting(body) {
  return /^(hi|hello|hey|sup|bro|yo|good morning|good evening)$/i.test(String(body || '').trim());
}

function fastGreetingReply() {
  const response = enforceMemoryPolicyOnResponse([
    'CTO: Founder, team is online.',
    'CODER: Ready.',
    'REVIEWER: Standing by.',
    'AUDITOR: Monitoring active.'
  ].join('\n'), {
    message: 'fast greeting'
  });
  return enforceExecutionSchemaOnRoute({
    command: 'fast_greeting',
    matchedRoute: 'server_fast_greeting',
    response
  }, {
    message: 'fast greeting',
    memorySources: ['current message', 'session memory unavailable']
  }).response;
}

function logVisibleWebhook(stage, details = {}) {
  const body = typeof details.body === 'string' ? details.body : '';
  const safe = {
    requestId: details.requestId || null,
    from: details.from ? maskPhoneForConsole(details.from) : null,
    bodyLength: body.length || null,
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
  app.use(express.json({
    limit: '32kb',
    verify: (req, res, buffer) => {
      req.rawBody = buffer ? buffer.toString('utf8') : '';
    }
  }));
  app.use(express.urlencoded({ extended: false }));
  app.use('/product-lab/screenshots', express.static(path.join(REPO_ROOT, 'artifacts', 'product-lab', 'screenshots')));

  app.get('/healthz', (req, res) => {
    const configError = assertProductionConfig();
    const state = loadEngineeringState();
    const freshness = workflowFreshness(state);
    const diagnostics = startupSelfCheck({
      nodeEnv: process.env.NODE_ENV,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: TWILIO_AUTH_TOKEN,
      twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
      metaWhatsappAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN || '',
      metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || '',
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
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: TWILIO_AUTH_TOKEN,
      twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
      metaWhatsappAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN || '',
      metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || '',
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

  app.post('/metrics/ingest', createMetricsIngestHandler({ root: REPO_ROOT }));

  app.post('/brain/question', async (req, res) => {
    const auth = validateBrainApiAuth(req);
    if (!auth.ok) return res.status(401).json({ ok: false, reason: auth.reason });
    const question = req.body && typeof req.body.question === 'string' ? req.body.question : '';
    const answer = await answerFounderBrainQuestion({
      question,
      root: REPO_ROOT,
      publicBaseUrl: PUBLIC_BASE_URL
    });
    return res.status(200).json(answer);
  });

  app.get('/meta/whatsapp', (req, res) => {
    const verification = verifyMetaChallenge(req.query || {});
    if (!verification.ok) return res.status(403).send(verification.reason);
    return res.status(200).send(verification.challenge);
  });

  app.post('/meta/whatsapp', async (req, res) => {
    const startedAt = Date.now();
    const id = requestId();
    const signature = validateMetaSignature(req);
    if (!signature.valid) {
      logWebhookEvent({
        type: 'meta_signature_rejected',
        requestId: id,
        from: '',
        body: '',
        status: 403,
        durationMs: Date.now() - startedAt,
        meta: signature
      });
      return res.status(403).json({ ok: false, reason: signature.reason });
    }

    const messages = extractMetaMessages(req.body || {});
    if (!messages.length) return res.status(200).json({ ok: true, ignored: true });

    res.status(200).json({ ok: true, accepted: messages.length });
    for (const incoming of messages) {
      handleMetaIncomingMessage({ incoming, requestId: id, startedAt }).catch((error) => {
        console.log(`[whatsapp-cto] META WEBHOOK HANDLER ERROR requestId=${id} message=${error.message}`);
      });
    }
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
      const requestBaseUrl = PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const routed = await routeMessageWithAi(body, state, memory, {
        commit: process.env.CTO_AI_EXECUTION_COMMIT !== 'false',
        push: process.env.CTO_AI_EXECUTION_PUSH !== 'false',
        deferLowRiskVisionExecution: true,
        root: REPO_ROOT,
        publicBaseUrl: requestBaseUrl
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
      const memoryDetails = {
        ...(routed.details || {}),
        founderMessage: body,
        agentAnswer: routed.response,
        pendingAction: routed.details && routed.details.pendingAction
      };
      if (routed.command === 'agent') {
        updateConversationMemory(memoryDetails, state);
      } else {
        updateMemory(routed.command, state, memoryDetails);
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
      res.status(200).type('text/xml').send(twiml(routed.response, routed.mediaUrls || []));
      if (routed.command === 'vision_command_execution_started') {
        runDeferredVisionExecution({
          requestId: id,
          entry: routed.details && routed.details.visionCommand,
          incoming
        });
      }
      if (routed.command === 'product_lab_screenshot_workflow') {
        runDeferredProductLabScreenshotDelivery({
          requestId: id,
          incoming,
          publicBaseUrl: requestBaseUrl
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

async function handleMetaIncomingMessage({ incoming, requestId, startedAt }) {
  const from = incoming.from;
  const body = incoming.body;
  const messageSid = incoming.messageSid;

  const configError = assertProductionConfig();
  if (configError) {
    logWebhookEvent({ type: 'meta_config_error', requestId, from, body, status: 503, error: configError });
    return;
  }
  if (guard.isAbusive(from)) {
    logWebhookEvent({ type: 'meta_abuse_blocked', requestId, from, body, status: 403 });
    return;
  }
  if (FOUNDER_WHATSAPP_NUMBER && !samePhoneNumber(from, FOUNDER_WHATSAPP_NUMBER)) {
    guard.recordAbuse(from, 'bad_sender');
    logWebhookEvent({ type: 'meta_sender_rejected', requestId, from, body, status: 403 });
    return;
  }
  const replay = guard.checkReplay(messageSid);
  if (replay.replayed) {
    logWebhookEvent({ type: 'meta_replay_rejected', requestId, from, body, status: 409, meta: { messageSid } });
    return;
  }
  const rate = guard.checkRateLimit(from);
  if (rate.limited) {
    logWebhookEvent({ type: 'meta_rate_limited', requestId, from, body, status: 429, meta: { count: rate.count } });
    return;
  }

  const reply = isFastGreeting(body)
    ? { command: 'fast_greeting', response: fastGreetingReply(), mediaUrls: [] }
    : await routeMetaMessage(body, requestId);

  await sendWhatsAppMessageWithFallback({
    body: reply.response,
    mediaUrls: reply.mediaUrls || [],
    twilio: {
      accountSid: '',
      authToken: TWILIO_AUTH_TOKEN,
      from: incoming.to ? `whatsapp:${incoming.to}` : '',
      to: `whatsapp:${from}`
    },
    meta: {
      to: from
    }
  });

  logWebhookEvent({
    type: 'meta_reply',
    requestId,
    from,
    body,
    command: reply.command,
    status: 200,
    durationMs: Date.now() - startedAt,
    meta: { matchedRoute: reply.matchedRoute || reply.command }
  });

  if (reply.command === 'vision_command_execution_started') {
    runDeferredVisionExecution({ requestId, entry: reply.details && reply.details.visionCommand, incoming });
  }
  if (reply.command === 'product_lab_screenshot_workflow') {
    runDeferredProductLabScreenshotDelivery({
      requestId,
      incoming,
      publicBaseUrl: PUBLIC_BASE_URL
    });
  }
}

async function routeMetaMessage(body, requestId) {
  const state = loadEngineeringState();
  state.workflowFreshness = workflowFreshness(state);
  const memory = readConversationMemory();
  const routed = await routeMessageWithAi(body, state, memory, {
    commit: process.env.CTO_AI_EXECUTION_COMMIT !== 'false',
    push: process.env.CTO_AI_EXECUTION_PUSH !== 'false',
    deferLowRiskVisionExecution: true,
    root: REPO_ROOT,
    publicBaseUrl: PUBLIC_BASE_URL
  });
  const memoryDetails = {
    ...(routed.details || {}),
    founderMessage: body,
    agentAnswer: routed.response,
    pendingAction: routed.details && routed.details.pendingAction
  };
  if (routed.command === 'agent') {
    updateConversationMemory(memoryDetails, state);
  } else {
    updateMemory(routed.command, state, memoryDetails);
  }
  rememberFounderInteraction({
    founderMessage: body,
    agentDecision: routed.command,
    executed: /execution|approved/i.test(routed.command),
    outcome: routed.response,
    commitHash: routed.details && routed.details.visionCommand && routed.details.visionCommand.commitHash
  });
  return routed;
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
      await sendWhatsAppMessageWithFallback({
        body: message,
        twilio: {
          accountSid: incoming.accountSid,
          authToken: TWILIO_AUTH_TOKEN,
          from: incoming.to,
          to: `whatsapp:${incoming.from}`
        },
        meta: {
          to: incoming.from
        }
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
      await sendWhatsAppMessageWithFallback({
        body: [
          'CODER: Could not complete this safely, Founder.',
          'Result: DEFERRED_EXECUTION_FAILED',
          `Reason: ${error.message}`
        ].join('\n'),
        twilio: {
          accountSid: incoming.accountSid,
          authToken: TWILIO_AUTH_TOKEN,
          from: incoming.to,
          to: `whatsapp:${incoming.from}`
        },
        meta: {
          to: incoming.from
        }
      }).catch((sendError) => {
        console.log(`[whatsapp-cto] DEFERRED EXECUTION SEND FAILED requestId=${requestId} message=${sendError.message}`);
      });
    }
  });
}

function runDeferredProductLabScreenshotDelivery({ requestId, incoming, publicBaseUrl }) {
  setImmediate(async () => {
    const maxAttempts = Number(process.env.PRODUCT_LAB_SCREENSHOT_POLL_ATTEMPTS || 40);
    const intervalMs = Number(process.env.PRODUCT_LAB_SCREENSHOT_POLL_INTERVAL_MS || 30000);
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const result = await fetchLatestProductLabScreenshot({
          root: REPO_ROOT,
          publicBaseUrl,
          env: process.env
        });
        if (result.status === 'READY') {
          await sendWhatsAppMessageWithFallback({
            body: [
              'CTO: Product Lab screenshot is ready.',
              `Run: ${result.runUrl}`,
              'Image attached for product review.',
              'No product code mutation started.'
            ].join('\n'),
            mediaUrls: result.mediaUrls || [],
            twilio: {
              accountSid: incoming.accountSid,
              authToken: TWILIO_AUTH_TOKEN,
              from: incoming.to,
              to: `whatsapp:${incoming.from}`
            },
            meta: {
              to: incoming.from
            }
          });
          logVisibleWebhook('product_lab_screenshot_sent', {
            requestId,
            from: incoming.from,
            body: 'product lab screenshot ready',
            command: 'product_lab_screenshot_ready',
            status: 200
          });
          return;
        }
        if (['FAILED', 'NO_ARTIFACT', 'NO_SCREENSHOT', 'CONFIG_REQUIRED'].includes(result.status)) {
          await sendWhatsAppMessageWithFallback({
            body: [
              'CTO: Product Lab screenshot could not be sent.',
              `Status: ${result.status}`,
              `Reason: ${result.message}`,
              result.runUrl ? `Run: ${result.runUrl}` : ''
            ].filter(Boolean).join('\n'),
            twilio: {
              accountSid: incoming.accountSid,
              authToken: TWILIO_AUTH_TOKEN,
              from: incoming.to,
              to: `whatsapp:${incoming.from}`
            },
            meta: {
              to: incoming.from
            }
          });
          return;
        }
        await sleep(intervalMs);
      }
      await sendWhatsAppMessageWithFallback({
        body: [
          'CTO: Product Lab screenshot is still not ready.',
          'Reply: latest screenshot',
          'No product code mutation started.'
        ].join('\n'),
        twilio: {
          accountSid: incoming.accountSid,
          authToken: TWILIO_AUTH_TOKEN,
          from: incoming.to,
          to: `whatsapp:${incoming.from}`
        },
        meta: {
          to: incoming.from
        }
      });
    } catch (error) {
      console.log(`[whatsapp-cto] PRODUCT LAB SCREENSHOT DELIVERY ERROR requestId=${requestId} message=${error.message}`);
    }
  });
}

function startProactiveVisionSteward({
  root = REPO_ROOT,
  intervalMs = Number(process.env.CTO_PROACTIVE_STEWARD_INTERVAL_MS || 60 * 60 * 1000),
  enabled = process.env.WHATSAPP_PROACTIVE_MESSAGES_ENABLED === 'true' &&
    process.env.CTO_PROACTIVE_STEWARD_ENABLED !== 'false',
  sendImpl = sendWhatsAppMessageWithFallback
} = {}) {
  if (!enabled) {
    console.log('[whatsapp-cto] proactive vision steward disabled');
    return null;
  }
  if (!FOUNDER_WHATSAPP_NUMBER) {
    console.log('[whatsapp-cto] proactive vision steward skipped: FOUNDER_WHATSAPP_NUMBER missing');
    return null;
  }

  const tick = async () => {
    const now = new Date();
    const engineeringState = loadEngineeringState();
    const body = process.env.CTO_PROACTIVE_MODEL_COUNCIL === 'false'
      ? buildVisionStewardMessage({ engineeringState, now })
      : await buildVisionStewardMessageWithModelCouncil({ engineeringState, now });
    const decision = evaluateProactiveNotification({
      root,
      type: 'vision_check',
      body,
      state: engineeringState,
      now
    });
    if (!decision.allowed) {
      console.log(`[whatsapp-cto] proactive vision steward suppressed: ${decision.reason}`);
      return decision;
    }
    const result = await sendImpl({
      body,
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_WHATSAPP_FROM || '',
        to: FOUNDER_WHATSAPP_NUMBER
      },
      meta: {
        to: FOUNDER_WHATSAPP_NUMBER
      }
    });
    recordNotificationDecision(root, decision, { body, now, sent: true });
    console.log(`[whatsapp-cto] proactive vision steward sent via ${result.provider}`);
    return { allowed: true, sent: true, provider: result.provider };
  };

  tick().catch((error) => {
    console.log(`[whatsapp-cto] proactive vision steward skipped: ${error.message}`);
  });
  const timer = setInterval(() => {
    tick().catch((error) => {
      console.log(`[whatsapp-cto] proactive vision steward skipped: ${error.message}`);
    });
  }, Math.max(60_000, intervalMs));
  return timer;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  const diagnostics = startupSelfCheck({
    nodeEnv: process.env.NODE_ENV,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: TWILIO_AUTH_TOKEN,
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
    metaWhatsappAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN || '',
    metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || '',
    allowUnverified: ALLOW_UNVERIFIED_WHATSAPP,
    founderNumber: FOUNDER_WHATSAPP_NUMBER
  });
  console.log(`[whatsapp-cto] startup self-check ok=${diagnostics.ok}`);
  logStartupExecutionDiagnostics();
  createApp().listen(PORT, () => {
    console.log(`[whatsapp-cto] listening on port ${PORT}`);
    startProactiveVisionSteward();
  });
}

module.exports = {
  createApp,
  buildTwilioMessageParams,
  sendWhatsAppMessageWithFallback,
  validateTwilioSignature,
  verifyMetaChallenge,
  validateMetaSignature,
  validateBrainApiAuth,
  extractMetaMessages,
  twiml,
  twimlMessages,
  chunkMessage,
  normalizePhone,
  samePhoneNumber,
  extractTwilioBody,
  startupExecutionDiagnostics,
  startProactiveVisionSteward
};
