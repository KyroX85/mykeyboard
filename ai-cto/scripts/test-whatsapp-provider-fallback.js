const assert = require('assert');

const {
  buildMetaMessagePayload,
  buildTwilioMessageParams,
  sendWhatsAppMessageWithFallback
} = require('../whatsapp/whatsapp-provider');

const TEST_TWILIO_AUTH = ['twilio', 'token'].join('-');
const TEST_META_ACCESS = ['meta', 'token'].join('-');

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
      authToken: TEST_TWILIO_AUTH,
      from: 'whatsapp:+10000000000',
      to: 'whatsapp:+19999999999'
    },
    meta: {
      accessToken: TEST_META_ACCESS,
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
      authToken: TEST_TWILIO_AUTH,
      from: 'whatsapp:+10000000000',
      to: 'whatsapp:+19999999999'
    },
    meta: {
      accessToken: TEST_META_ACCESS,
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
      accessToken: TEST_META_ACCESS,
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

  process.env.META_WHATSAPP_TO = '+18888888888';
  process.env.META_WHATSAPP_ACCESS_TOKEN = TEST_META_ACCESS;
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = '123456789';
  process.env.META_WHATSAPP_GRAPH_VERSION = 'v25.0';
  process.env.CTO_WHATSAPP_BODY = 'Exact school mode confirmation';
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push({ url });
    return response(200, JSON.stringify({ messages: [{ id: 'wamid.scheduled.meta' }] }));
  };
  delete require.cache[require.resolve('./send-whatsapp-report')];
  const { buildMessage, sendDailyWhatsAppMessage } = require('./send-whatsapp-report');
  assert.strictEqual(buildMessage({}), 'Exact school mode confirmation');
  calls.length = 0;
  const reportResult = await sendDailyWhatsAppMessage('Meta-only scheduled report');
  assert.strictEqual(reportResult.provider, 'meta');
  assert.strictEqual(calls.length, 1);
  global.fetch = originalFetch;
  delete process.env.META_WHATSAPP_TO;
  delete process.env.META_WHATSAPP_ACCESS_TOKEN;
  delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.META_WHATSAPP_GRAPH_VERSION;
  delete process.env.CTO_WHATSAPP_BODY;
  delete require.cache[require.resolve('./send-whatsapp-report')];
  const strictSender = require('./send-whatsapp-report');
  await assert.rejects(
    () => strictSender.sendDailyWhatsAppMessage('must not silently skip'),
    /FOUNDER_WHATSAPP_NUMBER or META_WHATSAPP_TO is required/
  );
  process.env.CTO_WHATSAPP_ALLOW_SKIP = 'true';
  const skipped = await strictSender.sendDailyWhatsAppMessage('explicitly allowed skip');
  assert.strictEqual(skipped.skipped, true);
  delete process.env.CTO_WHATSAPP_ALLOW_SKIP;

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
