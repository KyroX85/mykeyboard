const assert = require('assert');

const {
  buildJarvisSpeech,
  assertJarvisSpeechSafe,
  cleanSpeechText,
  estimateSpeechSeconds
} = require('../jarvis-speech-layer');

const fixtures = [
  {
    question: 'What kills Aritenis?',
    answer: 'Aritenis dies if it becomes better at building agents than solving user pain.'
  },
  {
    question: 'Why am I building Jarvis?',
    answer: 'Jarvis exists to reduce the burden humans carry alone without stealing direction.'
  },
  {
    question: 'Who am I becoming?',
    answer: 'You are becoming someone who values freedom more than achievement.'
  },
  {
    question: 'What contradiction do you see?',
    answer: 'You want freedom, but keep building systems that could become dependence.'
  }
];

for (const fixture of fixtures) {
  const speech = buildJarvisSpeech({
    rawReasoning: `${fixture.question}\nObjective: long internal reasoning should remain hidden.`,
    summary: `${fixture.answer} This longer explanation should be compressed before speech.`,
    voiceSummary: fixture.answer
  });

  const safety = assertJarvisSpeechSafe(speech.voiceSummary);
  assert.strictEqual(speech.voiceSummary, speech.spokenResponse);
  assert(safety.ok, `${fixture.question} should be safe speech: ${JSON.stringify(safety)}`);
  assert(safety.wordCount <= 15);
  assert(safety.estimatedSeconds <= 15);
  assert(!/Objective|internal reasoning|TASK_PLAN|APPROVE|Health|Momentum/i.test(speech.voiceSummary));
}

const noisySpeech = buildJarvisSpeech({
  voiceSummary: [
    'Memory Sources Used: founder_memory',
    'Route Confidence: 88%',
    'TASK_PLAN',
    'Aritenis dies if it becomes impressive instead of useful.'
  ].join('\n')
});

assert.strictEqual(noisySpeech.voiceSummary, 'Aritenis dies if it becomes impressive instead of useful');
assert.strictEqual(cleanSpeechText('Founder Brain: hidden\nJarvis should speak simply.'), 'Jarvis should speak simply.');
assert(estimateSpeechSeconds('Jarvis should speak simply') < 15);

const fallbackSpeech = buildJarvisSpeech({
  rawReasoning: 'You are building Jarvis because the deeper dream is not just a keyboard; it is a personal execution layer that reduces human burden.'
});

assert.strictEqual(
  fallbackSpeech.voiceSummary,
  'You are building Jarvis because the deeper dream is not just a keyboard'
);

console.log('Jarvis speech layer checks passed.');
