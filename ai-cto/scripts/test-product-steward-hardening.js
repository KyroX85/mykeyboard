const assert = require('assert');
const path = require('path');

process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(__dirname, '..', '..', '.tmp-governance-state.json');

const { setMode, enforceExecutionAllowed, writeState } = require('../../governance/governance');
const { detectLowInformation } = require('../uncertainty-filter');
const { detectContradictions } = require('../governance-consistency-engine');
const { computePressureSummary } = require('../product-nervous-system');
const { runStewardLoop } = require('../product-steward-system');

function run() {
  resetState();

  setMode('PRESERVATION_ONLY', 'test');
  const blocked = enforceExecutionAllowed('file_write', { source: 'test' });
  assert.strictEqual(blocked.allowed, false, 'preservation mode must block mutation');

  const low = detectLowInformation('banana quantum potato');
  assert.strictEqual(low.lowInformation, true, 'nonsense must be low information');
  assert.ok(/LOW INFORMATION DETECTED/.test(low.response), 'response copy must match policy');

  const contradictions = detectContradictions([{
    mode: 'PRESERVATION_ONLY',
    executionAllowed: true,
    action: 'commit'
  }]);
  assert.strictEqual(contradictions.ok, false, 'contradiction must be detected');
  assert.ok(contradictions.incidents.length > 0, 'incident list required');

  const pressure = computePressureSummary({
    swipeFailureClusters: 15,
    swipeAttempts: 20,
    correctionBursts: 9,
    latencySpikes: 3
  });
  assert.strictEqual(Array.isArray(pressure.feed), true, 'priority feed required');
  assert.strictEqual(pressure.feed[0].name, 'typingFeel', 'highest pressure should prioritize typing feel first');

  setMode('ACTIVE', 'test');
  const loop = runStewardLoop({
    request: 'stabilize swipe trust with low-risk correction tuning',
    proposal: 'swipe failure reduction',
    signals: { swipeFailureClusters: 8, swipeAttempts: 10, correctionBursts: 5 },
    stability: { evidenceStrength: 80, trustRisk: 20, rollbackComplexity: 20 },
    action: 'analyze'
  });
  assert.strictEqual(loop.phase, 'PHASE_1_TRUSTED_KEYBOARD', 'phase lock required');
  assert.strictEqual(loop.execution.allowed, true, 'analysis should be allowed in active mode');

  console.log('test-product-steward-hardening: PASS');
}

function resetState() {
  writeState({ mode: 'ACTIVE', realAutonomyScore: 62, incidents: [] });
}

run();
