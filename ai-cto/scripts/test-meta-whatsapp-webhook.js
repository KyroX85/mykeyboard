const assert = require('assert');
const crypto = require('crypto');

process.env.META_WHATSAPP_VERIFY_TOKEN = 'verify-test-token';
process.env.META_APP_SECRET = 'meta-app-secret';
delete require.cache[require.resolve('../whatsapp-server')];

const {
  verifyMetaChallenge,
  validateMetaSignature,
  extractMetaMessages,
  samePhoneNumber
} = require('../whatsapp-server');

const challenge = verifyMetaChallenge({
  'hub.mode': 'subscribe',
  'hub.verify_token': 'verify-test-token',
  'hub.challenge': '123456'
});
assert.strictEqual(challenge.ok, true);
assert.strictEqual(challenge.challenge, '123456');

const rejected = verifyMetaChallenge({
  'hub.mode': 'subscribe',
  'hub.verify_token': 'wrong',
  'hub.challenge': '123456'
});
assert.strictEqual(rejected.ok, false);

const body = JSON.stringify({ object: 'whatsapp_business_account' });
const signature = `sha256=${crypto
  .createHmac('sha256', process.env.META_APP_SECRET)
  .update(Buffer.from(body, 'utf8'))
  .digest('hex')}`;
const validSignature = validateMetaSignature({
  rawBody: body,
  body: JSON.parse(body),
  get: (name) => (name === 'X-Hub-Signature-256' ? signature : '')
});
assert.strictEqual(validSignature.valid, true);

const invalidSignature = validateMetaSignature({
  rawBody: body,
  body: JSON.parse(body),
  get: () => 'sha256=bad'
});
assert.strictEqual(invalidSignature.valid, false);

const messages = extractMetaMessages({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: '123456789'
            },
            contacts: [{ wa_id: '919999999999' }],
            messages: [
              {
                from: '919999999999',
                id: 'wamid.test',
                type: 'text',
                text: { body: 'hi' }
              }
            ]
          }
        }
      ]
    }
  ]
});
assert.strictEqual(messages.length, 1);
assert.strictEqual(messages[0].from, '919999999999');
assert.strictEqual(messages[0].body, 'hi');
assert.strictEqual(messages[0].messageSid, 'wamid.test');
assert.strictEqual(messages[0].phoneNumberId, '123456789');
assert.strictEqual(samePhoneNumber('whatsapp:+91 99999 99999', '919999999999'), true);

console.log('Meta WhatsApp webhook checks passed.');
