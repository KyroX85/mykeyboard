const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function isProductLabScreenshotCommand(message = '') {
  const text = String(message || '').trim().toLowerCase();
  return /^(local screenshot|capture local screenshot|send local screenshot|take local screenshot|local keyboard screenshot|local product lab screenshot)$/.test(text);
}

function captureProductLabScreenshot({
  root = process.cwd(),
  adb = process.env.ADB_PATH || defaultAdbPath(),
  publicBaseUrl = process.env.PUBLIC_BASE_URL || '',
  outputDir = path.join(root, 'artifacts', 'product-lab', 'screenshots'),
  name = '',
  execFileSyncImpl = execFileSync,
  dryRun = false
} = {}) {
  const fileName = sanitizeFileName(name || `aritenis-keyboard-${timestamp()}.png`);
  const filePath = path.join(outputDir, fileName);
  fs.mkdirSync(outputDir, { recursive: true });

  if (dryRun) {
    fs.writeFileSync(filePath, Buffer.from('dry-run-screenshot'));
  } else {
    if (!fs.existsSync(adb)) throw new Error(`ADB not found: ${adb}`);
    execFileSyncImpl(adb, ['wait-for-device'], { stdio: 'pipe', timeout: 60000 });
    const png = execFileSyncImpl(adb, ['exec-out', 'screencap', '-p'], {
      encoding: 'buffer',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 60000
    });
    if (!png || png.length < 1024) throw new Error('Screenshot capture returned empty or invalid image data.');
    fs.writeFileSync(filePath, png);
  }

  const publicUrl = buildPublicScreenshotUrl({ publicBaseUrl, fileName });
  return {
    ok: true,
    fileName,
    filePath,
    publicUrl,
    mediaUrls: publicUrl ? [publicUrl] : [],
    privacy: 'scripted Product Lab screenshot only; do not use personal chat content as test evidence'
  };
}

function buildScreenshotCaptureResponse(capture) {
  if (!capture || !capture.ok) {
    return {
      command: 'product_lab_screenshot_failed',
      matchedRoute: 'product_lab_screenshot_capture',
      details: { agent: 'cto', intent: 'product_lab_screenshot_failed' },
      response: [
        'CTO: Screenshot capture failed.',
        `Reason: ${capture && capture.error ? capture.error : 'unknown error'}`,
        'No product change started.'
      ].join('\n'),
      mediaUrls: []
    };
  }

  const lines = [
    'CTO: Captured current Product Lab screenshot.',
    `File: ${capture.filePath}`,
    capture.publicUrl
      ? 'Image attached for WhatsApp review.'
      : 'Image captured locally, but no PUBLIC_BASE_URL is configured, so WhatsApp cannot attach it yet.',
    'Next: compare spacing, edge keys, contrast, thumb targets, and visual density before proposing any fix.'
  ];

  return {
    command: 'product_lab_screenshot_captured',
    matchedRoute: 'product_lab_screenshot_capture',
    details: {
      agent: 'cto',
      intent: 'product_lab_screenshot_captured',
      filePath: capture.filePath,
      publicUrl: capture.publicUrl || null
    },
    response: lines.join('\n'),
    mediaUrls: capture.mediaUrls || []
  };
}

function defaultAdbPath() {
  if (process.env.ANDROID_HOME) return path.join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (process.env.ANDROID_SDK_ROOT) return path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  return path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
}

function buildPublicScreenshotUrl({ publicBaseUrl = '', fileName = '' } = {}) {
  if (!publicBaseUrl || !fileName) return '';
  return `${String(publicBaseUrl).replace(/\/$/, '')}/product-lab/screenshots/${encodeURIComponent(fileName)}`;
}

function sanitizeFileName(value) {
  const text = String(value || '').replace(/[^a-z0-9_.-]/gi, '-');
  return text.toLowerCase().endsWith('.png') ? text : `${text}.png`;
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

module.exports = {
  buildPublicScreenshotUrl,
  buildScreenshotCaptureResponse,
  captureProductLabScreenshot,
  isProductLabScreenshotCommand
};
