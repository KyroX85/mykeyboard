const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-founder-brain-api-${Date.now()}.json`);
process.env.BRAIN_API_TOKEN = 'brain-test-token';

const {
  answerFounderBrainQuestion,
  classifyBrainAnswerType,
  toVoiceSummary
} = require('../founder-brain-api');
const { validateBrainApiAuth } = require('../whatsapp-server');

const sampleState = {
  sections: {},
  changed: {},
  validation: [],
  summary: {},
  generatedAt: '2026-06-02T00:00:00.000Z'
};

(async () => {
  const reflection = await answerFounderBrainQuestion({
    question: "Bro what do you think I'm actually chasing?",
    state: sampleState,
    memory: {}
  });
  assert.strictEqual(reflection.type, 'reflection');
  assert(/personal intelligence layer|phone|daily workflows|Jarvis-style product/i.test(reflection.summary));
  assert(reflection.confidence > 0);
  assert(reflection.confidence <= 0.9);
  assert(reflection.rawReasoning.length > reflection.summary.length);
  assert(reflection.summary.split(/\s+/).length <= 50);
  assert(reflection.voiceSummary.split(/\s+/).length <= 15);
  assert.strictEqual(reflection.compression.summaryWords, 50);
  assert.strictEqual(reflection.compression.voiceWords, 15);
  assert(reflection.sources.includes('founder_memory'));
  assert(reflection.sources.includes('whatsapp_router'));

  const strategy = await answerFounderBrainQuestion({
    question: 'What happens if we focus only on the execution layer for 6 months?',
    state: sampleState,
    memory: {}
  });
  assert.strictEqual(strategy.type, 'strategy');
  assert(/tradeoff|opportunity cost|focus/i.test(strategy.rawReasoning));

  assert.strictEqual(classifyBrainAnswerType({ command: 'vision_command_approval_required' }), 'execution');
  assert.strictEqual(classifyBrainAnswerType({ command: 'recent_product_improvements' }), 'product');
  assert.strictEqual(toVoiceSummary('One.\nTwo.\nThree.', 12), 'One');
  assert.strictEqual(validateBrainApiAuth({
    get: () => 'Bearer brain-test-token'
  }).ok, true);
  assert.strictEqual(validateBrainApiAuth({
    get: () => 'Bearer wrong'
  }).ok, false);

  console.log('Founder Brain API checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
