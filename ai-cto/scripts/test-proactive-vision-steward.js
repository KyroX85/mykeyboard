const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildVisionStewardMessage,
  inferHighestVisionPressure,
  shouldSendProactiveVisionUpdate,
  recordProactiveVisionUpdate
} = require('../whatsapp/vision-steward');
const { routeMessage } = require('../whatsapp/command-router');
const { buildMessage } = require('./send-whatsapp-report');

const state = {
  healthScore: 82,
  momentum: 'STEADY',
  sections: {
    risks: ['Product Lab screenshot showed System UI is not responding.'],
    unresolved: [],
    approvals: []
  }
};

const pressure = inferHighestVisionPressure(state);
assert.strictEqual(pressure.topic, 'screenshot_explain_evidence');

const message = buildVisionStewardMessage({ engineeringState: state });
assert(message.includes('Founder, one vision check.'));
assert(message.includes('Company goal:'));
assert(message.includes('Suggested improvement:'));
assert(message.includes('proposal only'));
assert(!message.includes('Starting execution'));
assert(!message.includes('Commit:'));

const routed = routeMessage('vision check', state);
assert.strictEqual(routed.command, 'vision_steward_check');
assert(routed.response.includes('Founder, one vision check.'));
assert(routed.response.includes('no code change started'));

const daily = buildMessage(state);
assert(daily.includes('Founder, one vision check.'));
assert(daily.includes('Immediate alerts:'));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vision-steward-'));
try {
  const first = shouldSendProactiveVisionUpdate({
    root: tempRoot,
    now: new Date('2026-05-30T08:00:00.000Z'),
    minHoursBetween: 6,
    maxPerDay: 2
  });
  assert.strictEqual(first.allowed, true);
  recordProactiveVisionUpdate({
    root: tempRoot,
    now: new Date('2026-05-30T08:00:00.000Z'),
    topic: 'screenshot_explain_evidence'
  });
  const cooldown = shouldSendProactiveVisionUpdate({
    root: tempRoot,
    now: new Date('2026-05-30T10:00:00.000Z'),
    minHoursBetween: 6,
    maxPerDay: 2
  });
  assert.strictEqual(cooldown.allowed, false);
  assert.strictEqual(cooldown.reason, 'cooldown');
  const second = shouldSendProactiveVisionUpdate({
    root: tempRoot,
    now: new Date('2026-05-30T15:00:00.000Z'),
    minHoursBetween: 6,
    maxPerDay: 2
  });
  assert.strictEqual(second.allowed, true);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Proactive vision steward checks passed');
