const assert = require('assert');

const {
  detectFounderState,
  applyFounderStateToRoute,
  updateFounderStateMemory
} = require('../founder-state-detection-layer');

const samples = [
  {
    message: 'What happens if we focus only on Explain for six months?',
    state: 'STRATEGIC_MODE',
    style: /tradeoff|opportunity cost/i
  },
  {
    message: 'Would users care about this feature every day?',
    state: 'PRODUCT_MODE',
    style: /user pain|habit|retention/i
  },
  {
    message: 'Bro this is annoying, the agents keep missing what I mean.',
    state: 'FRUSTRATED_MODE',
    style: /direct|short|no templates/i
  },
  {
    message: 'Are we moving toward the dream and phone intelligence layer?',
    state: 'VISION_MODE',
    style: /dream|alignment|gap/i
  },
  {
    message: 'Implement this and commit it.',
    state: 'EXECUTION_MODE',
    style: /governance|verification|rollback/i
  }
];

for (const sample of samples) {
  const detected = detectFounderState(sample.message);
  assert.strictEqual(detected.state, sample.state, sample.message);
  assert.match(detected.responseStyle, sample.style, sample.message);
  assert(detected.confidence <= 92);
}

const routed = applyFounderStateToRoute({
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: 'This direction has risk.'
}, {
  message: 'What happens if we focus only on Explain for six months?'
});
assert.strictEqual(routed.details.founderState.state, 'STRATEGIC_MODE');
assert.strictEqual(routed.details.responseStyle, routed.details.founderState.responseStyle);
assert.doesNotMatch(routed.response, /Founder State:/);

const executionRoute = applyFounderStateToRoute({
  command: 'build_now',
  details: {},
  response: 'Build queued.'
}, {
  message: 'build now'
});
assert.doesNotMatch(executionRoute.response, /Founder State:/);

let memory = updateFounderStateMemory(null, detectFounderState(samples[0].message));
memory = updateFounderStateMemory(memory, detectFounderState(samples[2].message));
assert.strictEqual(memory.recentStates.length, 2);
assert.strictEqual(memory.lastState.state, 'FRUSTRATED_MODE');
assert.strictEqual(memory.stateCounts.STRATEGIC_MODE, 1);
assert.strictEqual(memory.stateCounts.FRUSTRATED_MODE, 1);

console.log('Founder state detection layer checks passed.');
