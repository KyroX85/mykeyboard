const assert = require('assert');
const path = require('path');

const {
  DREAM_MODEL,
  buildDreamAlignment,
  formatDreamAlignment,
  inferCurrentTask
} = require('../dream-model');
const { loadFounderMemoryLayer } = require('../founder-memory-layer');
const { routeMessage } = require('../whatsapp/command-router');

const root = path.resolve(__dirname, '..', '..');
const memoryLayer = loadFounderMemoryLayer({ root });

assert(DREAM_MODEL.longTermVision.includes('trusted phone-native intelligence layer'));
assert(DREAM_MODEL.personalAiEcosystemAmbition.includes('phone'));
assert(DREAM_MODEL.intelligenceLayerAmbition.includes('understand context'));
assert(DREAM_MODEL.keyboardAsVehicle.includes('entry point'));
assert(DREAM_MODEL.founderMotivations.some((item) => item.includes('Jarvis-style')));

const missingAlignment = buildDreamAlignment({
  question: 'What are we missing?',
  root,
  memoryLayer
});
assert.strictEqual(
  missingAlignment.currentTask,
  'Reconstruct the strategic gap between current work and the founder dream.'
);
assert(missingAlignment.projectGoal.includes('Explain'));
assert(missingAlignment.founderDream.includes('trusted phone-native intelligence layer'));
assert(missingAlignment.alignment.includes('Phase 2'));
assert(missingAlignment.summary.includes('->'));
assert(formatDreamAlignment(missingAlignment).includes('Founder dream:'));

assert.strictEqual(
  inferCurrentTask('Can Explain store screenshots forever?'),
  'Clarify or advance the Explain wedge without damaging keyboard trust.'
);

const missingRoute = routeMessage('What are we missing?', {}, {});
assert.strictEqual(missingRoute.matchedRoute, 'founder_objective_engine');
assert(missingRoute.response.includes('Dream alignment:'));
assert(missingRoute.response.includes('Current task:'));
assert(missingRoute.response.includes('Project goal:'));
assert(missingRoute.response.includes('Founder dream:'));

const dreamRoute = routeMessage('Bro are we even moving toward the dream?', {}, {});
assert.strictEqual(dreamRoute.matchedRoute, 'founder_mind_reconstruction');
assert(dreamRoute.response.includes('Dream alignment:'));
assert(dreamRoute.response.includes('personal intelligence layer') || dreamRoute.response.includes('phone-native intelligence layer'));

console.log('Dream model checks passed.');
