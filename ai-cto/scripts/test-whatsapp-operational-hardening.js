const assert = require('assert');
const { createOperationalGuard } = require('../whatsapp/operational-guard');
const { chunkMessage } = require('../whatsapp/message-chunker');
const { workflowFreshness, startupSelfCheck } = require('../whatsapp/diagnostics');
const { readJsonWithRecovery } = require('../whatsapp/state-reader');
const { readMemory, writeMemory, MEMORY_FILE } = require('../whatsapp/memory-store');
const fs = require('fs');

const guard = createOperationalGuard({
  rateWindowMs: 1000,
  rateMax: 2,
  commandCooldownMs: 500,
  replayWindowMs: 1000,
  abuseWindowMs: 1000,
  abuseMax: 1
});

assert.strictEqual(guard.checkRateLimit('+1').limited, false);
assert.strictEqual(guard.checkRateLimit('+1').limited, false);
assert.strictEqual(guard.checkRateLimit('+1').limited, true);

assert.strictEqual(guard.checkCommandCooldown('+1', 'status').coolingDown, false);
assert.strictEqual(guard.checkCommandCooldown('+1', 'status').coolingDown, true);

assert.strictEqual(guard.checkReplay('SM123').replayed, false);
assert.strictEqual(guard.checkReplay('SM123').replayed, true);

assert.strictEqual(guard.recordAbuse('+2', 'bad_signature').blocked, false);
assert.strictEqual(guard.recordAbuse('+2', 'bad_signature').blocked, true);
assert.strictEqual(guard.isAbusive('+2'), true);

const chunks = chunkMessage('a '.repeat(2000), 200);
assert(chunks.length > 1);
assert(chunks[0].startsWith('Part 1/'));

const stale = workflowFreshness({ generatedAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() });
assert.strictEqual(stale.stale, true);

const fresh = workflowFreshness({ generatedAt: new Date().toISOString() });
assert.strictEqual(fresh.ok, true);

const check = startupSelfCheck({
  nodeEnv: 'test',
  twilioAuthToken: '',
  allowUnverified: true,
  founderNumber: '+1'
});
assert.strictEqual(typeof check.ok, 'boolean');

const recovered = readJsonWithRecovery('missing-file-for-test.json', { ok: true });
assert.deepStrictEqual(recovered, { ok: true });

const originalMemory = fs.existsSync(MEMORY_FILE) ? fs.readFileSync(MEMORY_FILE, 'utf8') : null;
fs.writeFileSync(MEMORY_FILE, '{ broken json');
const memory = readMemory();
assert.strictEqual(memory.version, '1.0');
writeMemory(memory);
assert(JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')).version);
if (originalMemory === null) {
  fs.unlinkSync(MEMORY_FILE);
} else {
  fs.writeFileSync(MEMORY_FILE, originalMemory);
}

console.log('WhatsApp operational hardening checks passed.');
