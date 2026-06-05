const assert = require('assert');
const {
  analyze,
  classifyQuestionIntent,
  classifyUnderstanding,
  founderSuccessExpectedQuestions,
  isQuestionCorrect,
  wordErrorRate,
} = require('../product-lab/jarvis-reliability-log-analyzer');

const sampleLog = `
I  Vosk wake started: grammar=hey jarvis
I  Vosk wake metric: FALSE_WAKE; phrase="jarvis"; confidence=0.00; source=partial; audioSource=unknown; reason=single word or incomplete wake phrase
I  Vosk wake metric: REAL_WAKE; phrase="hey jarvis"; confidence=1.00; source=result; audioSource=unknown; reason=complete hey jarvis phrase
I  Wake word detected
I  SpeechRecognizer start: state=COMMAND_CAPTURE; purpose=command
I  Jarvis command captured: chars=18; transcript="who am i becoming"; confidence=0.91; alternative1="who am i becoming"; alternative1Confidence=0.91; alternative2="who i am becoming"; alternative2Confidence=0.74
I  Founder Brain request started: session=abc attempt=0
I  Founder Brain response received after 800ms: session=abc attempt=0
I  Founder Brain voiceSummary received: chars=39
I  Jarvis state transition: SPEAKING -> RETURN_TO_IDLE; reason=speech complete
`;

const report = analyze(sampleLog, ['who am i becoming']);

assert.strictEqual(report.questionUnderstanding.accuracy, '100%');
assert.strictEqual(report.questionUnderstanding.speechReport.title, 'JARVIS SPEECH REPORT');
assert.strictEqual(report.questionUnderstanding.speechReport.correct, 1);
assert.strictEqual(report.falseWakeReport.title, 'FALSE WAKE REPORT');
assert.strictEqual(report.falseWakeReport.realWakeCount, 1);
assert.strictEqual(report.falseWakeReport.falseWakeCount, 1);
assert.strictEqual(report.falseWakeReport.falseWakeRate, '50%');
assert.strictEqual(report.falseWakeReport.topFalseTriggerPhrases[0].phrase, 'jarvis');
assert.strictEqual(report.questionUnderstanding.perQuestion['who am i becoming'].accuracy, '100%');
assert.strictEqual(report.questionUnderstanding.top10FailedTranscripts.length, 0);
assert.strictEqual(report.wake.detected, 1);
assert.strictEqual(report.wake.successRateFromObservedStarts, '100%');
assert.strictEqual(report.command.captureRate, '100%');
assert.strictEqual(report.command.transcripts[0].wordErrorRate, 0);
assert.strictEqual(report.command.transcripts[0].confidence, 0.91);
assert.strictEqual(report.command.transcripts[0].alternatives[0].transcript, 'who am i becoming');
assert.strictEqual(report.founderBrain.averageLatencyMs, 800);
assert.strictEqual(report.likelyLargestFailureSource, 'No failure visible in this log sample.');
assert.strictEqual(wordErrorRate('what kills aritenis', 'what kills arthritis'), 1 / 3);
assert.strictEqual(classifyQuestionIntent('who i am becoming'), 'who am i becoming');
assert.strictEqual(isQuestionCorrect('whats our dream', 'what is our dream'), true);
assert.strictEqual(isQuestionCorrect('what kills aritenis', 'what kills arthritis'), false);
assert.strictEqual(classifyUnderstanding('what kills aritenis', 'what kills'), 'PARTIAL');
assert.strictEqual(founderSuccessExpectedQuestions()[0], 'what am i building');
assert.strictEqual(founderSuccessExpectedQuestions().length, 50);

const failureLog = `
I  Vosk wake started: grammar=hey jarvis
I  Wake word detected
I  SpeechRecognizer start: state=COMMAND_CAPTURE; purpose=command
I  Jarvis command captured: chars=20; transcript="what kills arthritis"; confidence=0.48; alternative1="what kills arthritis"; alternative1Confidence=0.48; alternative2="what kills aritenis"; alternative2Confidence=0.41
I  Founder Brain request started: session=abc attempt=0
I  Founder Brain voiceSummary received: chars=39
`;
const failureReport = analyze(failureLog, ['what kills aritenis']);
assert.strictEqual(failureReport.questionUnderstanding.accuracy, '0%');
assert.strictEqual(failureReport.questionUnderstanding.partial, 1);
assert.strictEqual(failureReport.questionUnderstanding.wrong, 0);
assert.strictEqual(failureReport.questionUnderstanding.top10FailedTranscripts[0].failureSource, 'transcription');
assert.strictEqual(failureReport.questionUnderstanding.top10FailedTranscripts[0].confidence, 0.48);
assert.strictEqual(failureReport.questionUnderstanding.top10FailedTranscripts[0].alternatives[1].transcript, 'what kills aritenis');
assert.deepStrictEqual(failureReport.questionUnderstanding.top10FailedTranscripts[0].missingWords, ['aritenis']);
assert.strictEqual(failureReport.questionUnderstanding.mostCommonMissingWords[0].word, 'aritenis');
assert.strictEqual(failureReport.questionUnderstanding.top20MisheardPhrases[0].phrase, 'what kills aritenis -> what kills arthritis');

const legacyLog = `
I  Wake word detected
I  SpeechRecognizer start: state=COMMAND_CAPTURE; purpose=command
I  Jarvis command captured: chars=18
I  Founder Brain voiceSummary received: chars=39
`;
const legacyReport = analyze(legacyLog, ['who am i becoming']);
assert.strictEqual(legacyReport.questionUnderstanding.scoredAttempts, 0);
assert.strictEqual(legacyReport.questionUnderstanding.unscorableAttempts, 1);
assert.strictEqual(legacyReport.questionUnderstanding.accuracy, 'unknown');

console.log('jarvis reliability log analyzer tests passed');
