#!/usr/bin/env node

const fs = require('fs');

function usage() {
  console.error('Usage: node ai-cto/product-lab/jarvis-reliability-log-analyzer.js <logcat.txt> [expected.json|--founder-success]');
  console.error('expected.json format: ["what am i building", "who am i becoming"]');
  console.error('--founder-success expects 10 attempts each in this order: who am i becoming, what am i building, what kills aritenis, whats our dream, how is work going');
}

function normalizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function wordErrorRate(expected, actual) {
  const expectedWords = normalizeWords(expected);
  const actualWords = normalizeWords(actual);
  if (expectedWords.length === 0) return actualWords.length === 0 ? 0 : 1;
  return levenshtein(expectedWords, actualWords) / expectedWords.length;
}

function normalizedText(text) {
  return normalizeWords(text).join(' ');
}

function founderSuccessExpectedQuestions(repetitions = 10) {
  const questions = [
    'who am i becoming',
    'what am i building',
    'what kills aritenis',
    'whats our dream',
    'how is work going',
  ];
  return questions.flatMap((question) => Array(repetitions).fill(question));
}

function classifyQuestionIntent(text) {
  const words = new Set(normalizeWords(text));
  if (words.has('who') && words.has('becoming')) return 'who am i becoming';
  if (words.has('what') && words.has('building')) return 'what am i building';
  if (words.has('what') && words.has('kills') && words.has('aritenis')) return 'what kills aritenis';
  if ((words.has('what') || words.has('whats')) && words.has('dream')) return 'whats our dream';
  if (words.has('how') && words.has('work') && words.has('going')) return 'how is work going';
  return null;
}

function isQuestionCorrect(expected, actual) {
  if (!expected || !actual) return false;
  const expectedIntent = classifyQuestionIntent(expected);
  const actualIntent = classifyQuestionIntent(actual);
  if (expectedIntent && actualIntent) return expectedIntent === actualIntent;
  return normalizedText(expected) === normalizedText(actual);
}

function missingWords(expected, actual) {
  const actualWords = new Set(normalizeWords(actual));
  return normalizeWords(expected).filter((word) => !actualWords.has(word));
}

function extraWords(expected, actual) {
  const expectedWords = new Set(normalizeWords(expected));
  return normalizeWords(actual).filter((word) => !expectedWords.has(word));
}

function percent(numerator, denominator) {
  if (!denominator) return 'unknown';
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

function extractTranscript(line) {
  const match = line.match(/transcript="([^"]*)"/);
  return match ? match[1] : '';
}

function hasTranscriptField(line) {
  return /transcript="[^"]*"/.test(line);
}

function classifyFailureSource({ expected, actual, commandStarted, commandCaptured, brainResponded }) {
  if (!commandStarted) return 'wake';
  if (!commandCaptured || !actual) return 'transcription';
  if (!isQuestionCorrect(expected, actual)) return 'transcription';
  if (!brainResponded) return 'Founder Brain';
  return null;
}

function analyze(logText, expected = []) {
  const lines = logText.split(/\r?\n/);
  const counters = {
    wakeEngineStarts: 0,
    wakeFallbackStarts: 0,
    wakeDetected: 0,
    commandStarts: 0,
    commandCaptured: 0,
    commandErrors: 0,
    brainRequests: 0,
    brainTimeouts: 0,
    brainResponses: 0,
    ttsResponses: 0,
    sessionsCompleted: 0,
  };
  const attempts = [];
  let currentAttempt = null;
  const brainLatenciesMs = [];
  const failures = [];

  for (const line of lines) {
    if (line.includes('Vosk wake started') || line.includes('Porcupine wake started')) counters.wakeEngineStarts += 1;
    if (line.includes('purpose=wake-fallback')) counters.wakeFallbackStarts += 1;
    if (line.includes('Wake word detected')) {
      counters.wakeDetected += 1;
        currentAttempt = {
        wakeDetected: true,
        commandStarted: false,
        commandCaptured: false,
        transcript: '',
        transcriptAvailable: false,
        brainResponded: false,
      };
      attempts.push(currentAttempt);
    }
    if (line.includes('SpeechRecognizer start: state=COMMAND_CAPTURE')) {
      counters.commandStarts += 1;
      if (!currentAttempt) {
        currentAttempt = { wakeDetected: false, commandStarted: true, commandCaptured: false, transcript: '', transcriptAvailable: false, brainResponded: false };
        attempts.push(currentAttempt);
      }
      currentAttempt.commandStarted = true;
    }
    if (line.includes('Jarvis command captured:')) {
      counters.commandCaptured += 1;
      if (!currentAttempt) {
        currentAttempt = { wakeDetected: false, commandStarted: false, commandCaptured: true, transcript: '', transcriptAvailable: false, brainResponded: false };
        attempts.push(currentAttempt);
      }
      currentAttempt.commandCaptured = true;
      currentAttempt.transcriptAvailable = hasTranscriptField(line);
      currentAttempt.transcript = extractTranscript(line);
    }
    if (line.includes('command recognizer error') || line.includes('SpeechRecognizer error:') && line.includes('COMMAND_CAPTURE')) {
      counters.commandErrors += 1;
    }
    if (line.includes('Founder Brain request started') || line.includes('Founder Brain question captured')) counters.brainRequests += 1;
    if (line.includes('SocketTimeoutException') || line.includes('timeout')) counters.brainTimeouts += 1;
    if (line.includes('Founder Brain response received after')) {
      counters.brainResponses += 1;
      const match = line.match(/after\s+(\d+)ms/);
      if (match) brainLatenciesMs.push(Number(match[1]));
    }
    if (line.includes('Founder Brain voiceSummary received')) counters.ttsResponses += 1;
    if (line.includes('Founder Brain voiceSummary received') && currentAttempt) currentAttempt.brainResponded = true;
    if (line.includes('reason=speech complete')) counters.sessionsCompleted += 1;
  }

  const transcriptRows = attempts.map((attempt, index) => {
    const expectedTranscript = expected[index] || '';
    const actual = attempt.transcript || '';
    const unscorableLegacyLog = Boolean(expectedTranscript && attempt.commandCaptured && !attempt.transcriptAvailable);
    const correct = expectedTranscript && !unscorableLegacyLog ? isQuestionCorrect(expectedTranscript, actual) : null;
    return {
      index: index + 1,
      expected: expectedTranscript || null,
      actual,
      transcriptAvailable: attempt.transcriptAvailable,
      unscorableLegacyLog,
      correct,
      failureSource: expectedTranscript && !unscorableLegacyLog ? classifyFailureSource({
        expected: expectedTranscript,
        actual,
        commandStarted: attempt.commandStarted,
        commandCaptured: attempt.commandCaptured,
        brainResponded: attempt.brainResponded,
      }) : null,
      wordErrorRate: expectedTranscript ? Math.round(wordErrorRate(expectedTranscript, actual) * 1000) / 1000 : null,
      missingWords: expectedTranscript && !correct ? missingWords(expectedTranscript, actual) : [],
      extraWords: expectedTranscript && !correct ? extraWords(expectedTranscript, actual) : [],
    };
  });

  const expectedRows = transcriptRows.filter((row) => row.expected && !row.unscorableLegacyLog);
  const unscorableRows = transcriptRows.filter((row) => row.expected && row.unscorableLegacyLog);
  const correctRows = expectedRows.filter((row) => row.correct);
  const failedRows = expectedRows.filter((row) => row.correct === false);
  const perQuestion = {};
  for (const row of expectedRows) {
    perQuestion[row.expected] ||= { attempts: 0, correct: 0, accuracy: 'unknown' };
    perQuestion[row.expected].attempts += 1;
    if (row.correct) perQuestion[row.expected].correct += 1;
  }
  for (const stats of Object.values(perQuestion)) {
    stats.accuracy = percent(stats.correct, stats.attempts);
  }
  const wordMissCounts = {};
  for (const row of failedRows) {
    for (const word of row.missingWords) {
      wordMissCounts[word] = (wordMissCounts[word] || 0) + 1;
    }
  }
  const failureSourceCounts = {};
  for (const row of failedRows) {
    const source = row.failureSource || 'unknown';
    failureSourceCounts[source] = (failureSourceCounts[source] || 0) + 1;
  }

  const averageBrainLatencyMs = brainLatenciesMs.length
    ? Math.round(brainLatenciesMs.reduce((sum, value) => sum + value, 0) / brainLatenciesMs.length)
    : null;

  if (counters.wakeFallbackStarts > 0) failures.push('Wake fallback path used.');
  if (counters.commandErrors > 0) failures.push('Command recognizer error occurred.');
  if (counters.brainTimeouts > 0) failures.push('Founder Brain network timeout occurred.');
  if (counters.commandStarts > counters.commandCaptured) failures.push('At least one command capture did not produce a transcript.');

  return {
    questionUnderstanding: {
      expectedAttempts: expected.length,
      observedAttempts: attempts.length,
      scoredAttempts: expectedRows.length,
      unscorableAttempts: unscorableRows.length,
      correct: correctRows.length,
      accuracy: percent(correctRows.length, expectedRows.length),
      perQuestion,
      top10FailedTranscripts: failedRows.slice(0, 10).map((row) => ({
        index: row.index,
        expected: row.expected,
        actual: row.actual,
        wordErrorRate: row.wordErrorRate,
        failureSource: row.failureSource,
        missingWords: row.missingWords,
        extraWords: row.extraWords,
      })),
      mostCommonMissingWords: Object.entries(wordMissCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([word, count]) => ({ word, count })),
      failureSourceCounts,
      note: expected.length ? 'Correct means the recognized transcript maps to the same founder question intent. Logs from APKs before transcript logging are marked unscorable.' : 'Pass expected questions or --founder-success to score question understanding accuracy.',
    },
    wake: {
      engineStarts: counters.wakeEngineStarts,
      fallbackStarts: counters.wakeFallbackStarts,
      detected: counters.wakeDetected,
      successRateFromObservedStarts: percent(counters.wakeDetected, counters.wakeEngineStarts + counters.wakeFallbackStarts),
      note: 'Missed wake attempts cannot be counted from logcat unless an attempt marker is logged or manually counted.',
    },
    command: {
      starts: counters.commandStarts,
      captured: counters.commandCaptured,
      errors: counters.commandErrors,
      captureRate: percent(counters.commandCaptured, counters.commandStarts),
      transcripts: transcriptRows,
    },
    founderBrain: {
      requests: counters.brainRequests,
      responses: counters.brainResponses,
      timeouts: counters.brainTimeouts,
      averageLatencyMs: averageBrainLatencyMs,
    },
    voice: {
      voiceSummariesReceived: counters.ttsResponses,
      completedSpeechSessions: counters.sessionsCompleted,
    },
    likelyLargestFailureSource: failures[0] || 'No failure visible in this log sample.',
    visibleFailures: failures,
  };
}

function main() {
  const [logPath, expectedArg] = process.argv.slice(2);
  if (!logPath) {
    usage();
    process.exit(1);
  }
  const logText = fs.readFileSync(logPath, 'utf8');
  const expected = expectedArg === '--founder-success'
    ? founderSuccessExpectedQuestions()
    : expectedArg ? JSON.parse(fs.readFileSync(expectedArg, 'utf8')) : [];
  console.log(JSON.stringify(analyze(logText, expected), null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  analyze,
  classifyQuestionIntent,
  founderSuccessExpectedQuestions,
  isQuestionCorrect,
  wordErrorRate,
};
