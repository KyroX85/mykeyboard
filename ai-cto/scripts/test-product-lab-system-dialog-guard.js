const assert = require('assert');
const {
  detectSystemDialog,
  findNodeBounds
} = require('../product-lab/adb/system-dialog-guard');

const anrXml = `
<hierarchy>
  <node text="System UI isn&apos;t responding" bounds="[100,500][900,620]" />
  <node text="Close app" bounds="[250,760][520,840]" />
  <node text="Wait" bounds="[250,900][420,980]" />
</hierarchy>`;

const normalXml = `
<hierarchy>
  <node text="Aritenis Product Lab" bounds="[250,90][840,160]" />
  <node text="scripted test phrase" bounds="[20,190][1060,340]" />
</hierarchy>`;

const detected = detectSystemDialog(anrXml);
assert.strictEqual(detected.detected, true);
assert.deepStrictEqual(findNodeBounds(anrXml, 'Wait'), {
  left: 250,
  top: 900,
  right: 420,
  bottom: 980,
  centerX: 335,
  centerY: 940
});

assert.strictEqual(detectSystemDialog(normalXml).detected, false);

console.log('Product Lab system dialog guard checks passed');
