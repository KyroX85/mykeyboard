function buildTwilioMessageParams({ from, to, body, mediaUrls = [] } = {}) {
  const params = new URLSearchParams();
  params.set('From', ensureWhatsappPrefix(from));
  params.set('To', ensureWhatsappPrefix(to));
  params.set('Body', body || '');
  for (const mediaUrl of Array.isArray(mediaUrls) ? mediaUrls : [mediaUrls]) {
    if (mediaUrl) params.append('MediaUrl', String(mediaUrl));
  }
  return params;
}

function buildMetaMessagePayload({ to, body, mediaUrls = [] } = {}) {
  return {
    messaging_product: 'whatsapp',
    to: normalizeMetaRecipient(to),
    type: 'text',
    text: {
      preview_url: false,
      body: withMediaLinks(body, mediaUrls)
    }
  };
}

async function sendTwilioWhatsAppMessage({
  accountSid = process.env.TWILIO_ACCOUNT_SID || '',
  authToken = process.env.TWILIO_AUTH_TOKEN || '',
  from = process.env.TWILIO_WHATSAPP_FROM || '',
  to = process.env.FOUNDER_WHATSAPP_NUMBER || '',
  body,
  mediaUrls = [],
  fetchImpl = fetch
} = {}) {
  if (!accountSid || !authToken || !from || !to) {
    throw new Error('Twilio WhatsApp sender is not fully configured.');
  }
  const params = buildTwilioMessageParams({ from, to, body, mediaUrls });
  const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Twilio send failed ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function sendMetaWhatsAppMessage({
  accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || '',
  graphVersion = process.env.META_WHATSAPP_GRAPH_VERSION || 'v25.0',
  to = process.env.META_WHATSAPP_TO || process.env.FOUNDER_WHATSAPP_NUMBER || '',
  body,
  mediaUrls = [],
  fetchImpl = fetch
} = {}) {
  if (!accessToken || !phoneNumberId || !to) {
    throw new Error('Meta WhatsApp sender is not fully configured.');
  }
  const payload = buildMetaMessagePayload({ to, body, mediaUrls });
  const response = await fetchImpl(`https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Meta WhatsApp send failed ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function sendWhatsAppMessageWithFallback({
  body,
  mediaUrls = [],
  twilio = {},
  meta = {},
  fetchImpl = fetch
} = {}) {
  const attempts = [];
  try {
    const twilioResult = await sendTwilioWhatsAppMessage({ ...twilio, body, mediaUrls, fetchImpl });
    attempts.push({ provider: 'twilio', ok: true });
    return {
      provider: 'twilio',
      fallbackUsed: false,
      attempts,
      result: twilioResult
    };
  } catch (error) {
    attempts.push({ provider: 'twilio', ok: false, error: error.message });
  }

  try {
    const metaResult = await sendMetaWhatsAppMessage({ ...meta, body, mediaUrls, fetchImpl });
    attempts.push({ provider: 'meta', ok: true });
    return {
      provider: 'meta',
      fallbackUsed: true,
      attempts,
      result: metaResult
    };
  } catch (error) {
    attempts.push({ provider: 'meta', ok: false, error: error.message });
    const summary = attempts.map((attempt) => `${attempt.provider}: ${attempt.ok ? 'ok' : attempt.error}`).join(' | ');
    throw new Error(`All WhatsApp providers failed. ${summary}`);
  }
}

function ensureWhatsappPrefix(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  return /^whatsapp:/i.test(text) ? text : `whatsapp:${text}`;
}

function normalizeMetaRecipient(value = '') {
  return String(value || '').replace(/^whatsapp:/i, '').replace(/[^\d]/g, '');
}

function withMediaLinks(body = '', mediaUrls = []) {
  const urls = (Array.isArray(mediaUrls) ? mediaUrls : [mediaUrls]).filter(Boolean);
  if (!urls.length) return body || '';
  return [body || '', '', ...urls.map((url) => `Media: ${url}`)].join('\n').trim();
}

module.exports = {
  buildTwilioMessageParams,
  buildMetaMessagePayload,
  sendTwilioWhatsAppMessage,
  sendMetaWhatsAppMessage,
  sendWhatsAppMessageWithFallback,
  normalizeMetaRecipient,
  ensureWhatsappPrefix
};
