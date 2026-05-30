const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const {
  extractFirstPng,
  findSystemDialogEvidence,
  fetchLatestProductLabScreenshot
} = require('../whatsapp/product-lab-artifact-fetcher');
const { routeMessageWithAi } = require('../whatsapp/command-router');

function localZipEntry(name, bytes) {
  const compressed = zlib.deflateRawSync(bytes);
  const nameBuffer = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuffer, compressed]);
}

(async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const zip = localZipEntry('artifacts/product-lab/screenshots/emulator-smoke.png', png);
  const extracted = extractFirstPng(zip);
  assert.strictEqual(extracted.name, 'artifacts/product-lab/screenshots/emulator-smoke.png');
  assert.deepStrictEqual([...extracted.bytes], [...png]);

  const anrXml = Buffer.from('<node text="System UI isn&apos;t responding" /><node text="Wait" />');
  const unhealthyZip = Buffer.concat([
    localZipEntry('artifacts/product-lab-window-after-screenshot.xml', anrXml),
    localZipEntry('artifacts/product-lab/screenshots/emulator-smoke.png', png)
  ]);
  assert.deepStrictEqual(findSystemDialogEvidence(unhealthyZip), {
    name: 'artifacts/product-lab-window-after-screenshot.xml'
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'product-lab-artifact-'));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (String(url).includes('/actions/workflows/product-lab-validation.yml/runs')) {
      return jsonResponse({
        workflow_runs: [{
          id: 123,
          event: 'workflow_dispatch',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/KyroX85/mykeyboard/actions/runs/123'
        }]
      });
    }
    if (String(url).includes('/actions/runs/123/artifacts')) {
      return jsonResponse({
        artifacts: [{
          name: 'product-lab-validation',
          expired: false,
          archive_download_url: 'https://api.github.com/artifact.zip'
        }]
      });
    }
    if (String(url).includes('artifact.zip')) {
      return binaryResponse(zip);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const result = await fetchLatestProductLabScreenshot({
      root: tempRoot,
      publicBaseUrl: 'https://render.example',
      env: { GITHUB_ACTIONS_TOKEN: 'token' },
      fetchImpl
    });
    assert.strictEqual(result.status, 'READY');
    assert.strictEqual(result.mediaUrls.length, 1);
    assert(fs.existsSync(result.filePath));
    assert(result.publicUrl.includes('/product-lab/screenshots/github-product-lab-123.png'));

    const routed = await routeMessageWithAi('latest screenshot', {}, {}, {
      root: tempRoot,
      publicBaseUrl: 'https://render.example',
      env: { GITHUB_ACTIONS_TOKEN: 'token' },
      fetchImpl
    });
    assert.strictEqual(routed.command, 'product_lab_screenshot_ready');
    assert.strictEqual(routed.mediaUrls.length, 1);

    const latestKeyboardVisual = await routeMessageWithAi('send the screenshot of the latest keyboard visual', {}, {}, {
      root: tempRoot,
      publicBaseUrl: 'https://render.example',
      env: { GITHUB_ACTIONS_TOKEN: 'token' },
      fetchImpl
    });
    assert.strictEqual(latestKeyboardVisual.command, 'product_lab_screenshot_ready');
    assert.strictEqual(latestKeyboardVisual.mediaUrls.length, 1);
    assert(!latestKeyboardVisual.response.includes('Product Lab evidence, not a mutation request'));

    const unhealthyFetchImpl = async (url) => {
      if (String(url).includes('/actions/workflows/product-lab-validation.yml/runs')) {
        return jsonResponse({
          workflow_runs: [{
            id: 456,
            event: 'workflow_dispatch',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/KyroX85/mykeyboard/actions/runs/456'
          }]
        });
      }
      if (String(url).includes('/actions/runs/456/artifacts')) {
        return jsonResponse({
          artifacts: [{
            name: 'product-lab-validation',
            expired: false,
            archive_download_url: 'https://api.github.com/unhealthy-artifact.zip'
          }]
        });
      }
      if (String(url).includes('unhealthy-artifact.zip')) {
        return binaryResponse(unhealthyZip);
      }
      throw new Error(`Unexpected URL: ${url}`);
    };
    const unhealthyResult = await fetchLatestProductLabScreenshot({
      root: tempRoot,
      publicBaseUrl: 'https://render.example',
      env: { GITHUB_ACTIONS_TOKEN: 'token' },
      fetchImpl: unhealthyFetchImpl
    });
    assert.strictEqual(unhealthyResult.status, 'UNHEALTHY_SCREENSHOT');
    assert(!unhealthyResult.mediaUrls);

    const unhealthyRouted = await routeMessageWithAi('latest screenshot', {}, {}, {
      root: tempRoot,
      publicBaseUrl: 'https://render.example',
      env: { GITHUB_ACTIONS_TOKEN: 'token' },
      fetchImpl: unhealthyFetchImpl
    });
    assert.strictEqual(unhealthyRouted.command, 'product_lab_screenshot_unhealthy');
    assert(!unhealthyRouted.mediaUrls);
    assert(unhealthyRouted.response.includes('screenshot was rejected'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('Product Lab artifact fetcher checks passed');
})();

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

function binaryResponse(payload) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
  };
}
