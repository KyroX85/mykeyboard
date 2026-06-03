const assert = require('assert');

const {
  compressStrategicAnswer,
  buildSummary,
  buildVoiceSummary,
  stripOperationalNoise,
  removeDanglingEnding
} = require('../strategic-compression-layer');

const longAnswer = [
  'Memory Sources Used: founder_memory, session_memory',
  'Route Confidence: 84%',
  'You are not asking for a status update. You are asking whether the work is moving toward the founder dream.',
  'The strongest answer is partial alignment: the infrastructure improved, but the product still needs a daily user outcome.',
  'If Explain becomes useful inside real conversations, it moves toward the dream.',
  'If the team keeps building governance, it becomes impressive but not useful.',
  'The missing proof is whether normal users would open the execution layer repeatedly without being told to.'
].join('\n');

const compressed = compressStrategicAnswer(longAnswer);

assert(!compressed.summary.includes('Memory Sources Used'));
assert(!compressed.summary.includes('Route Confidence'));
assert(compressed.rawReasoning.split(/\s+/).length <= 500);
assert(compressed.summary.split(/\s+/).length <= 50);
assert(compressed.voiceSummary.split(/\s+/).length <= 15);
assert(compressed.summary.includes('founder dream') || compressed.summary.includes('daily user outcome'));
assert.strictEqual(compressed.limits.reasoningWords, 500);
assert.strictEqual(compressed.limits.summaryWords, 50);
assert.strictEqual(compressed.limits.voiceWords, 15);

assert.strictEqual(
  buildVoiceSummary('Aritenis must prove Explain becomes a daily habit before expanding.', 8),
  'Aritenis must prove Explain becomes a daily habit'
);

assert.strictEqual(
  buildVoiceSummary('You are building Jarvis because the deeper dream is not just a keyboard; it is a personal execution layer.', 15),
  'You are building Jarvis because the deeper dream is not just a keyboard'
);

assert.strictEqual(removeDanglingEnding('The deeper dream is not just a keyboard; it is...'), 'The deeper dream is not just a keyboard');
assert.strictEqual(removeDanglingEnding('Aritenis dies if it becomes better at building agents than solving user pain. The danger...'), 'Aritenis dies if it becomes better at building agents than solving user pain.');
assert.strictEqual(removeDanglingEnding('You are becoming less interested in proving you can build advanced systems, and more interested...'), 'You are becoming less interested in proving you can build advanced systems');
assert.strictEqual(removeDanglingEnding('The contradiction is that you want freedom, but you keep trying to reach it by...'), 'The contradiction is that you want freedom, but you keep trying to reach it');

assert.strictEqual(
  stripOperationalNoise('TASK_PLAN\nAPPROVE-123\nReal answer.').trim(),
  'Real answer.'
);

assert(buildSummary('First sentence. Second sentence. Third sentence.', 4).split(/\s+/).length <= 4);

console.log('Strategic compression layer checks passed.');
