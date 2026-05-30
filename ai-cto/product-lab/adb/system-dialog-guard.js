const { execFileSync } = require('child_process');

const SYSTEM_DIALOG_PATTERNS = [
  /isn['’]t responding/i,
  /is not responding/i,
  /keeps stopping/i,
  /close app/i,
  /\bwait\b/i
];

function detectSystemDialog(xml = '') {
  const text = String(xml || '');
  const matched = SYSTEM_DIALOG_PATTERNS.some((pattern) => pattern.test(text));
  return {
    detected: matched,
    waitButton: findNodeBounds(text, 'Wait'),
    closeButton: findNodeBounds(text, 'Close app')
  };
}

function findNodeBounds(xml, visibleText) {
  const escaped = String(visibleText).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const node = String(xml || '').match(new RegExp(`<node[^>]*(?:text|content-desc)="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  if (!node) return null;
  const [, left, top, right, bottom] = node.map(Number);
  return {
    left,
    top,
    right,
    bottom,
    centerX: Math.round((left + right) / 2),
    centerY: Math.round((top + bottom) / 2)
  };
}

function dumpWindowXml({ adb = 'adb', remotePath = '/sdcard/product-lab-window.xml' } = {}) {
  execFileSync(adb, ['shell', 'uiautomator', 'dump', remotePath], { stdio: 'pipe', timeout: 30000 });
  return execFileSync(adb, ['exec-out', 'cat', remotePath], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30000
  });
}

function guardSystemDialog({ adb = 'adb', attempts = 3, sleepMs = 3000 } = {}) {
  let latest = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = dumpWindowXml({ adb });
    const dialog = detectSystemDialog(latest);
    if (!dialog.detected) {
      return { ok: true, attempts: attempt, action: 'none' };
    }
    if (!dialog.waitButton) {
      return { ok: false, attempts: attempt, action: 'unhandled_dialog', xml: latest };
    }
    execFileSync(adb, ['shell', 'input', 'tap', String(dialog.waitButton.centerX), String(dialog.waitButton.centerY)], {
      stdio: 'pipe',
      timeout: 30000
    });
    sleep(sleepMs);
  }

  latest = dumpWindowXml({ adb });
  const finalDialog = detectSystemDialog(latest);
  return {
    ok: !finalDialog.detected,
    attempts,
    action: finalDialog.detected ? 'dialog_remained' : 'wait_dismissed',
    xml: latest
  };
}

function sleep(ms) {
  const end = Date.now() + Number(ms || 0);
  while (Date.now() < end) {
    // Small CLI utility; blocking sleep keeps the workflow script simple.
  }
}

if (require.main === module) {
  const result = guardSystemDialog({
    adb: process.env.ADB_PATH || 'adb',
    attempts: Number(process.env.PRODUCT_LAB_DIALOG_GUARD_ATTEMPTS || 3),
    sleepMs: Number(process.env.PRODUCT_LAB_DIALOG_GUARD_SLEEP_MS || 3000)
  });
  if (!result.ok) {
    console.error(`Product Lab blocked: Android system dialog remained (${result.action}).`);
    process.exit(2);
  }
  console.log(`Product Lab system dialog guard passed: ${result.action}; attempts=${result.attempts}`);
}

module.exports = {
  detectSystemDialog,
  findNodeBounds,
  guardSystemDialog
};
