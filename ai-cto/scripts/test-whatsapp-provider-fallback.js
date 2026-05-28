const assert = require('assert');

const {
  buildMetaMessagePayload,
  buildTwilioMessageParams,
  sendWhatsAppMessageWithFallback
} = require('../whatsapp/whatsapp-provider');

const twilioParams = buildTwilioMessageParams({
  from: 'whatsapp:+10000000000',
  to: 'whatsapp:+19999999999',
  body: 'Aritenis report',
  mediaUrls: ['https://example.com/ux.png']
});
assert.strictEqual(twilioParams.get('From'), 'whatsapp:+10000000000');
assert.strictEqual(twilioParams.get('To'), 'whatsapp:+19999999999');
assert.strictEqual(twilioParams.get('Body'), 'Aritenis report');
assert.strictEqual(twilioParams.get('MediaUrl'), 'https://example.com/ux.png');

const metaPayload = buildMetaMessagePayload({
  to: 'whatsapp:+19999999999',
  body: 'Aritenis report'
});
assert.strictEqual(metaPayload.messaging_product, 'whatsapp');
assert.strictEqual(metaPayload.to, '19999999999');
assert.strictEqual(metaPayload.type, 'text');
assert.strictEqual(metaPayload.text.body, 'Aritenis report');

(async () => {
  const calls = [];
  const fallbackResult = await sendWhatsAppMessageWithFallback({
    body: 'Twilio exhausted, use Meta',
    twilio: {
      accountSid: 'AC123',
      authToken: 'twilio-token',
      from: 'whatsapp:+10000000000',
      to: 'whatsapp:+19999999999'
    },
    meta: {
      accessToken: 'meta-token',
      phoneNumberId: '123456789',
      to: 'whatsapp:+19999999999',
      graphVersion: 'v25.0'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (String(url).includes('twilio.com')) {
        return response(429, 'Twilio limit exceeded');
      }
      return response(200, JSON.stringify({ messages: [{ id: 'wamid.test' }] }));
    }
  });
  assert.strictEqual(fallbackResult.provider, 'meta');
  assert.strictEqual(fallbackResult.fallbackUsed, true);
  assert.strictEqual(calls.length, 2);
  assert(String(calls[1].url).includes('https://graph.facebook.com/v25.0/123456789/messages'));
  assert.strictEqual(JSON.parse(calls[1].options.body).to, '19999999999');

  calls.length = 0;
  const twilioResult = await sendWhatsAppMessageWithFallback({
    body: 'Twilio works',
    twilio: {
      accountSid: 'AC123',
      authToken: 'twilio-token',
      from: 'whatsapp:+10000000000',
      to: 'whatsapp:+19999999999'
    },
    meta: {
      accessToken: 'meta-token',
      phoneNumberId: '123456789',
      to: 'whatsapp:+19999999999',
      graphVersion: 'v25.0'
    },
    fetchImpl: async (url) => {
      calls.push({ url });
      return response(201, JSON.stringify({ sid: 'SM123' }));
    }
  });
  assert.strictEqual(twilioResult.provider, 'twilio');
  assert.strictEqual(twilioResult.fallbackUsed, false);
  assert.strictEqual(calls.length, 1);

  calls.length = 0;
  const metaOnlyResult = await sendWhatsAppMessageWithFallback({
    body: 'Twilio missing, Meta configured',
    twilio: {},
    meta: {
      accessToken: 'meta-token',
      phoneNumberId: '123456789',
      to: '+19999999999',
      graphVersion: 'v25.0'
    },
    fetchImpl: async (url) => {
      calls.push({ url });
      return response(200, JSON.stringify({ messages: [{ id: 'wamid.meta.only' }] }));
    }
  });
  assert.strictEqual(metaOnlyResult.provider, 'meta');
  assert.strictEqual(metaOnlyResult.fallbackUsed, true);
  assert.strictEqual(calls.length, 1);

  console.log('WhatsApp provider fallback checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body)
  };
}
