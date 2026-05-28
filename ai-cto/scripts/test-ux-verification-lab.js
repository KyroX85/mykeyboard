const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  compareKeyboardTargets,
  formatUxComparisonReport,
  generateComparisonSvg
} = require('../ux-lab/keyboard-comparison-engine');
const { buildEmulatorUxLabPlan } = require('../ux-lab/emulator-runner');

const aritenis = {
  name: 'Aritenis',
  screenshot: 'aritenis.png',
  keys: [
    { id: 'q', x: 0, y: 0, width: 38, height: 46 },
    { id: 'a', x: 4, y: 52, width: 36, height: 44 },
    { id: 'space', x: 90, y: 156, width: 150, height: 48 }
  ]
};

const mature = {
  name: 'Mature baseline',
  screenshot: 'gboard.png',
  keys: [
    { id: 'q', x: 0, y: 0, width: 44, height: 50 },
    { id: 'a', x: 4, y: 52, width: 44, height: 50 },
    { id: 'space', x: 82, y: 156, width: 170, height: 50 }
  ]
};

const comparison = compareKeyboardTargets({
  candidate: aritenis,
  baseline: mature,
  minThumbTargetPx: 44
});

assert.strictEqual(comparison.status, 'ATTENTION_NEEDED');
assert.strictEqual(comparison.findings.length, 2);
assert(comparison.findings.some((finding) => finding.keyId === 'q'));
assert(comparison.findings.some((finding) => finding.keyId === 'a'));
assert(comparison.summary.includes('2 thumb-target'));
assert(!comparison.summary.toLowerCase().includes('architecture'));

const report = formatUxComparisonReport(comparison);
assert(report.includes('WHAT WAS COMPARED'));
assert(report.includes('TRUST IMPACT'));
assert(report.includes('APPROVAL REQUIRED BEFORE PATCH'));
assert(report.includes('q'));

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-ux-lab-'));
const imagePath = path.join(outDir, 'comparison.svg');
generateComparisonSvg({
  comparison,
  outputFile: imagePath
});

assert(fs.existsSync(imagePath));
const image = fs.readFileSync(imagePath, 'utf8');
assert(image.includes('Aritenis'));
assert(image.includes('Mature baseline'));
assert(image.includes('q'));
assert(image.includes('thumb target'));

const plan = buildEmulatorUxLabPlan({
  apkPath: 'app/build/outputs/apk/debug/app-debug.apk',
  packageName: 'com.example.mykeyboard',
  screenshotFile: 'artifacts/ux/aritenis-keyboard.png'
});
assert(plan.commands.some((command) => command.includes('gradlew')));
assert(plan.commands.some((command) => command.includes('adb install')));
assert(plan.commands.some((command) => command.includes('ime enable')));
assert(plan.commands.some((command) => command.includes('screencap')));
assert.strictEqual(plan.mutationPolicy, 'analysis-only until founder approval');
assert.strictEqual(plan.privacy.rawTextStored, false);

fs.rmSync(outDir, { recursive: true, force: true });

console.log('UX verification lab passed');
