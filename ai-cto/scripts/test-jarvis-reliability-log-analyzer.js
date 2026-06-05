const assert = require('assert');
const { analyze, wordErrorRate } = require('../product-lab/jarvis-reliability-log-analyzer');

const sampleLog = `
I  Vosk wake started: grammar=hey jarvis
I  Wake word detected
I  SpeechRecognizer start: state=COMMAND_CAPTURE; purpose=command
I  Jarvis command captured: chars=18; transcript="who am i becoming"
I  Founder Brain request started: session=abc attempt=0
I  Founder Brain response received after 800ms: session=abc attempt=0
I  Founder Brain voiceSummary received: chars=39
I  Jarvis state transition: SPEAKING -> RETURN_TO_IDLE; reason=speech complete
`;

const report = analyze(sampleLog, ['who am i becoming']);

assert.strictEqual(report.wake.detected, 1);
assert.strictEqual(report.wake.successRateFromObservedStarts, '100%');
assert.strictEqual(report.command.captureRate, '100%');
assert.strictEqual(report.command.transcripts[0].wordErrorRate, 0);
assert.strictEqual(report.founderBrain.averageLatencyMs, 800);
assert.strictEqual(report.likelyLargestFailureSource, 'No failure visible in this log sample.');
assert.strictEqual(wordErrorRate('what kills aritenis', 'what kills arthritis'), 1 / 3);

console.log('jarvis reliability log analyzer tests passed');
