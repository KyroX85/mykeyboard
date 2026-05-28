const assert = require('assert');
const fs = require('fs');
const path = require('path');

const bridge = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/src/main/java/com/example/mykeyboard/metrics/ProductSignalBridge.kt'
  ),
  'utf8'
);

assert(bridge.includes('10.0.2.2:3000/metrics/ingest'));
assert(bridge.includes('localhost:3000/metrics/ingest'));
assert(bridge.includes('INGEST_URLS'));
assert(!bridge.includes('rawText'));

console.log('Product signal bridge config passed');
