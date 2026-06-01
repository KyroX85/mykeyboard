const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-memory-compression-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-memory-compression-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-memory-compression-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-memory-compression-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-memory-compression-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-memory-compression-whatsapp-memory-${Date.now()}.json`);

const {
  compressFounderMemory,
  shouldCompressFounderMemory
} = require('../memory-compression-layer');
const {
  readConversationMemory,
  writeMemory
} = require('../whatsapp/memory-store');

function feedback(index, text) {
  return {
    timestamp: new Date(Date.now() - index * 60000).toISOString(),
    polarity: index % 3 === 0 ? 'positive' : 'negative',
    feedback: index % 2 === 0 ? 'too_generic' : 'good_answer',
    rawQuestionPreview: text,
    rawAnswerPreview: index % 2 === 0
      ? 'Health 30. Momentum stalled. Team ready.'
      : 'The useful answer connects the dream to user leverage and the unproven risk.',
    wrongAnswerAnalysis: index % 2 === 0
      ? { primaryFailureReason: 'wrong_route', failureReasons: ['wrong_route', 'wrong_depth'] }
      : null
  };
}

const memory = {
  founderFeedback: Array.from({ length: 50 }, (_, index) => feedback(index, [
    'Bro are we even moving toward the dream?',
    'I do not think users actually care.',
    'If we fail in 3 years why do we fail?',
    'What am I actually chasing?',
    'Something feels off.'
  ][index % 5])),
  founderQuestionClusters: {
    recentQuestions: Array.from({ length: 12 }, (_, index) => ({
      clusterId: ['DREAM_QUESTIONS', 'USER_VALUE_QUESTIONS', 'PREMORTEM_QUESTIONS'][index % 3],
      family: ['dream questions', 'user value questions', 'premortem questions'][index % 3],
      messagePattern: 'question pattern',
      confidence: 80
    }))
  },
  wrongAnswerAnalysis: {
    failureCounts: { wrong_route: 18, wrong_depth: 12, wrong_assumption: 6 }
  },
  memoryCompression: {
    lastCompressedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  }
};

assert.strictEqual(shouldCompressFounderMemory(memory), true);
const compressed = compressFounderMemory(memory);
assert(compressed.memoryCompression);
assert.strictEqual(compressed.memoryCompression.sourceConversationCount, 62);
assert.strictEqual(compressed.compressedFounderInsights.length, 5);
assert(compressed.compressedFounderInsights.some((item) => /dream/i.test(item.insight)));
assert(compressed.compressedFounderInsights.some((item) => /user value/i.test(item.insight)));
assert(compressed.compressedFounderInsights.some((item) => /wrong route/i.test(item.insight)));
assert(compressed.founderFeedback.length <= 20);
assert(compressed.memoryCompression.compressionCount >= 1);

const recentAt = new Date().toISOString();
const recentCompression = compressFounderMemory({
  ...memory,
  memoryCompression: { lastCompressedAt: recentAt }
});
assert.strictEqual(recentCompression.memoryCompression.lastCompressedAt, recentAt);

writeMemory(memory);
const stored = readConversationMemory();
assert(stored.compressedFounderInsights.length === 5);
assert(stored.memoryCompression.sourceConversationCount >= 50);

console.log('Memory compression layer checks passed.');
