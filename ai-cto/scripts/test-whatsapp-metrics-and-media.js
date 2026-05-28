const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-whatsapp-metrics-'));
fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
fs.writeFileSync(
  path.join(tempRoot, 'ai-cto', 'product-evidence-archive.json'),
  JSON.stringify({
    version: '1.0',
    privacy: 'aggregate metrics only; no raw text, no sentences, no keystroke history',
    entries: [],
    trends: {}
  })
);

process.env.ARITENIS_REPO_ROOT = tempRoot;

const {
  buildTwilioMessageParams,
  createApp
} = require('../whatsapp-server');

process.on('exit', () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const params = buildTwilioMessageParams({
  from: 'whatsapp:+10000000000',
  to: 'whatsapp:+19999999999',
  body: 'UX comparison ready',
  mediaUrls: ['https://example.com/aritenis-ux.svg']
});
assert.strictEqual(params.get('Body'), 'UX comparison ready');
assert.strictEqual(params.get('MediaUrl'), 'https://example.com/aritenis-ux.svg');

const app = createApp();
const server = app.listen(0, async () => {
  const port = server.address().port;
  const response = await postJson(port, '/metrics/ingest', {
    correctionBurstCount: 3,
    swipeFailureCount: 2,
    swipeAttempts: 10,
    rawText: 'private text should be dropped'
  });
  assert.strictEqual(response.statusCode, 204);

  const archive = JSON.parse(fs.readFileSync(path.join(tempRoot, 'ai-cto', 'product-evidence-archive.json'), 'utf8'));
  assert.strictEqual(archive.entries.length, 1);
  assert.strictEqual(archive.entries[0].source, 'keyboard-runtime');
  assert(!JSON.stringify(archive).includes('private text'));

  server.close(() => {
    console.log('WhatsApp metrics and media passed');
  });
});

function postJson(port, route, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: route,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      res.resume();
      res.on('end', () => resolve({ statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
