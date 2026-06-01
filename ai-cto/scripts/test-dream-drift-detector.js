const assert = require('assert');

const {
  detectDreamDrift,
  applyDreamDriftToRoute,
  updateDreamDriftMemory
} = require('../dream-drift-detector');

const drift = detectDreamDrift('Should we spend the next month building a scalable multi-agent orchestration dashboard?');
assert.strictEqual(drift.alert, true);
assert.strictEqual(drift.classification, 'DRIFTING_AWAY');
assert(drift.driftScore >= 65);
assert.match(drift.reason, /infrastructure|orchestration/i);
assert(drift.evidence.some((item) => /not directly user-visible/i.test(item)));

const aligned = detectDreamDrift('Should we improve Explain for confusing screenshots while protecting typing trust?');
assert.strictEqual(aligned.alert, false);
assert.strictEqual(aligned.classification, 'ALIGNED');
assert(aligned.alignmentScore >= 65);

const routed = applyDreamDriftToRoute({
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: 'This could be worth exploring.'
}, {
  message: 'What if we focus on governance reports and orchestration instead of Explain?'
});
assert.match(routed.response, /Dream drift alert/i);
assert.match(routed.response, /Founder dream/i);
assert.strictEqual(routed.details.dreamDrift.alert, true);

const executionRoute = applyDreamDriftToRoute({
  command: 'build_now',
  details: {},
  response: 'Build queued.'
}, {
  message: 'build now'
});
assert.doesNotMatch(executionRoute.response, /Dream drift alert/i);

let memory = updateDreamDriftMemory(null, drift);
memory = updateDreamDriftMemory(memory, aligned);
assert.strictEqual(memory.recentDriftChecks.length, 2);
assert.strictEqual(memory.driftAlertCount, 1);
assert.strictEqual(memory.lastDriftAlert.classification, 'DRIFTING_AWAY');

console.log('Dream drift detector checks passed.');
