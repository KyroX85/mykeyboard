const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildPublicScreenshotUrl,
  captureProductLabScreenshot,
  isProductLabScreenshotCommand
} = require('../product-lab/whatsapp-screenshot-capture');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const { twiml } = require('../whatsapp-server');

(async () => {
  assert.strictEqual(isProductLabScreenshotCommand('screenshot'), false);
  assert.strictEqual(isProductLabScreenshotCommand('local screenshot'), true);
  assert.strictEqual(isProductLabScreenshotCommand('capture local screenshot'), true);
  assert.strictEqual(isProductLabScreenshotCommand('what about screenshot evidence?'), false);

  assert.strictEqual(
    buildPublicScreenshotUrl({
      publicBaseUrl: 'https://example.ngrok-free.app/',
      fileName: 'aritenis-keyboard.png'
    }),
    'https://example.ngrok-free.app/product-lab/screenshots/aritenis-keyboard.png'
  );

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-shot-'));
  try {
    const capture = captureProductLabScreenshot({
      root: tempRoot,
      publicBaseUrl: 'https://example.ngrok-free.app',
      name: 'test-shot.png',
      dryRun: true
    });
    assert.strictEqual(capture.ok, true);
    assert(fs.existsSync(capture.filePath));
    assert.strictEqual(capture.mediaUrls.length, 1);

    const routed = await routeMessageWithAi('local screenshot', {}, {}, {
      root: tempRoot,
      publicBaseUrl: 'https://example.ngrok-free.app',
      screenshotCapture: {
        dryRun: true,
        name: 'whatsapp-shot.png'
      }
    });
    assert.strictEqual(routed.command, 'product_lab_screenshot_captured');
    assert.strictEqual(routed.matchedRoute, 'product_lab_screenshot_capture');
    assert.strictEqual(routed.mediaUrls.length, 1);
    assert(routed.response.includes('Image attached'));

    const syncPlan = routeMessage('screenshot', {}, {});
    assert.strictEqual(syncPlan.command, 'product_lab_screenshot_workflow_plan');
    assert(syncPlan.response.includes('GitHub Actions'));

    const localSyncPlan = routeMessage('local screenshot', {}, {});
    assert.strictEqual(localSyncPlan.command, 'product_lab_screenshot_captured');
    assert(localSyncPlan.response.includes('capture pending'));

    const xml = twiml('Founder screenshot ready', routed.mediaUrls);
    assert(xml.includes('<Media>https://example.ngrok-free.app/product-lab/screenshots/whatsapp-shot.png</Media>'));
    assert(xml.includes('<Body>Founder screenshot ready</Body>'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('WhatsApp screenshot capture checks passed');
})();
