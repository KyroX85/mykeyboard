const assert = require('assert');
const path = require('path');

const {
  buildRealityReconstruction,
  formatRealityReconstruction
} = require('../reality-reconstruction-layer');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const reconstruction = buildRealityReconstruction({
    root,
    question: 'Project audit. Answer only from memory.'
  });

  assert(reconstruction.confidence <= 90);
  assert(reconstruction.reconstruction.product.includes('Android keyboard'));
  assert(reconstruction.reconstruction.product.includes('understand confusing content'));
  assert(reconstruction.reconstruction.stage.includes('Phase 2'));
  assert(reconstruction.reconstruction.bottleneck.includes('Explain'));
  assert(reconstruction.reconstruction.shouldNotBuild.includes('auto-send'));
  assert(reconstruction.evidence.some((item) => item.includes('FOUNDER_VISION.md')));
  assert(reconstruction.uncertainty.length > 0);

  const formatted = formatRealityReconstruction(reconstruction);
  assert(formatted.includes('Reality reconstruction'));
  assert(formatted.includes('What product are we building?'));
  assert(formatted.includes('What stage are we in?'));
  assert(formatted.includes('What is the biggest bottleneck?'));
  assert(formatted.includes('What are we actively searching for?'));
  assert(formatted.includes('What assumptions are still unproven?'));
  assert(formatted.includes('What should not be built?'));
  assert(formatted.includes('Why I believe this:'));
  assert(formatted.includes('Evidence sources used:'));
  assert(formatted.includes('Missing information / uncertainty:'));
  assert(formatted.includes('Confidence:'));
  assert(!formatted.includes('100%'));
  assert(!formatted.includes('Current Foundation Health'));
  assert(!formatted.includes('Recommended Next Step'));

  const memoryAudit = routeMessage('memory audit', {}, {});
  assert.strictEqual(memoryAudit.command, 'memory_audit');
  assert.strictEqual(memoryAudit.matchedRoute, 'founder_memory_intent');
  assert(memoryAudit.response.includes('Reality reconstruction'));
  assert(memoryAudit.response.includes('Evidence sources used:'));
  assert(memoryAudit.response.includes('Missing information / uncertainty:'));
  assert(!memoryAudit.response.includes('Founder memory audit'));
  assert(!memoryAudit.response.includes('Current Foundation Health'));

  const strategicQuestion = await routeMessageWithAi('what is the final goal of our company?', {}, {}, {});
  assert.strictEqual(strategicQuestion.command, 'founder_intent_understanding');
  assert.strictEqual(strategicQuestion.matchedRoute, 'founder_intent_understanding');
  assert(strategicQuestion.response.includes('Founder objective I inferred:'));
  assert(strategicQuestion.response.includes('understand confusing content'));
  assert(strategicQuestion.response.includes('Why I believe this:'));
  assert(!strategicQuestion.response.includes('Recommended Next Step'));
  assert(!strategicQuestion.response.includes('Starting execution'));

  console.log('Reality reconstruction layer checks passed');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
