#!/usr/bin/env node

const fs = require('fs');

function usage() {
  console.error('Usage: node ai-cto/product-lab/jarvis-reliability-log-analyzer.js <logcat.txt> [expected.json]');
  console.error('expected.json format: ["what am i building", "who am i becoming"]');
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

function percent(numerator, denominator) {
  if (!denominator) return 'unknown';
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

function extractTranscript(line) {
  const match = line.match(/transcript="([^"]*)"/);
  return match ? match[1] : '';
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
  const transcripts = [];
  const brainLatenciesMs = [];
  const failures = [];

  for (const line of lines) {
    if (line.includes('Vosk wake started') || line.includes('Porcupine wake started')) counters.wakeEngineStarts += 1;
    if (line.includes('purpose=wake-fallback')) counters.wakeFallbackStarts += 1;
    if (line.includes('Wake word detected')) counters.wakeDetected += 1;
    if (line.includes('SpeechRecognizer start: state=COMMAND_CAPTURE')) counters.commandStarts += 1;
    if (line.includes('Jarvis command captured:')) {
      counters.commandCaptured += 1;
      transcripts.push(extractTranscript(line));
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
    if (line.includes('reason=speech complete')) counters.sessionsCompleted += 1;
  }

  const transcriptRows = transcripts.map((actual, index) => {
    const expectedTranscript = expected[index] || '';
    return {
      index: index + 1,
      expected: expectedTranscript || null,
      actual,
      wordErrorRate: expectedTranscript ? Math.round(wordErrorRate(expectedTranscript, actual) * 1000) / 1000 : null,
    };
  });

  const averageBrainLatencyMs = brainLatenciesMs.length
    ? Math.round(brainLatenciesMs.reduce((sum, value) => sum + value, 0) / brainLatenciesMs.length)
    : null;

  if (counters.wakeFallbackStarts > 0) failures.push('Wake fallback path used.');
  if (counters.commandErrors > 0) failures.push('Command recognizer error occurred.');
  if (counters.brainTimeouts > 0) failures.push('Founder Brain network timeout occurred.');
  if (counters.commandStarts > counters.commandCaptured) failures.push('At least one command capture did not produce a transcript.');

  return {
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
  const [logPath, expectedPath] = process.argv.slice(2);
  if (!logPath) {
    usage();
    process.exit(1);
  }
  const logText = fs.readFileSync(logPath, 'utf8');
  const expected = expectedPath ? JSON.parse(fs.readFileSync(expectedPath, 'utf8')) : [];
  console.log(JSON.stringify(analyze(logText, expected), null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { analyze, wordErrorRate };
