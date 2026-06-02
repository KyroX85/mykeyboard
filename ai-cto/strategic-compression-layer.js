const DEFAULT_REASONING_WORDS = 500;
const DEFAULT_SUMMARY_WORDS = 50;
const DEFAULT_VOICE_WORDS = 15;

function compressStrategicAnswer(answer = '', options = {}) {
  const reasoningWords = positiveInt(options.reasoningWords, DEFAULT_REASONING_WORDS);
  const summaryWords = positiveInt(options.summaryWords, DEFAULT_SUMMARY_WORDS);
  const voiceWords = positiveInt(options.voiceWords, DEFAULT_VOICE_WORDS);
  const cleaned = normalizeText(stripOperationalNoise(answer)) || normalizeText(answer);
  const rawReasoning = limitWords(cleaned, reasoningWords);
  const summary = buildSummary(rawReasoning, summaryWords);
  const voiceSummary = buildVoiceSummary(summary, voiceWords);

  return {
    rawReasoning,
    summary,
    voiceSummary,
    limits: {
      reasoningWords,
      summaryWords,
      voiceWords
    }
  };
}

function buildSummary(answer = '', maxWords = DEFAULT_SUMMARY_WORDS) {
  const cleaned = normalizeText(stripOperationalNoise(answer));
  if (!cleaned) return '';

  const sentences = splitSentences(cleaned);
  const selected = [];

  for (const sentence of sentences) {
    if (selected.join(' ').split(/\s+/).filter(Boolean).length >= maxWords) break;
    if (isLowSignalLine(sentence)) continue;
    selected.push(sentence);
    if (selected.join(' ').split(/\s+/).filter(Boolean).length >= Math.ceil(maxWords * 0.7)) break;
  }

  const candidate = selected.length ? selected.join(' ') : cleaned;
  return limitWords(candidate, maxWords);
}

function buildVoiceSummary(summary = '', maxWords = DEFAULT_VOICE_WORDS) {
  const cleaned = normalizeText(summary);
  if (!cleaned) return '';
  return limitWords(cleaned, maxWords).replace(/[.?!,;:]+$/, '');
}

function stripOperationalNoise(answer = '') {
  return String(answer || '')
    .split('\n')
    .filter((line) => !/^Memory Sources Used:/i.test(line))
    .filter((line) => !/^Route Confidence:/i.test(line))
    .filter((line) => !/^Route Reason:/i.test(line))
    .filter((line) => !/^type:\s*(AUDIT_REPORT|TASK_PLAN|EXECUTION_RESULT|CLARIFICATION_REQUEST)/i.test(line))
    .filter((line) => !/^intent:/i.test(line))
    .filter((line) => !/^TASK_PLAN\b/i.test(line))
    .filter((line) => !/^APPROVE\b/i.test(line))
    .join('\n');
}

function normalizeText(value = '') {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(text = '') {
  const flattened = normalizeText(text).replace(/\n+/g, ' ');
  const matches = flattened.match(/[^.?!]+[.?!]+|[^.?!]+$/g);
  return (matches || [flattened])
    .map((item) => item.trim())
    .filter(Boolean);
}

function limitWords(text = '', maxWords = DEFAULT_SUMMARY_WORDS) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ').replace(/[.?!,;:]+$/, '')}...`;
}

function isLowSignalLine(line = '') {
  return /^(current foundation health|phase 2 opportunities|highest leverage differentiator|trust risk|recommended next step)\s*:/i.test(line);
}

function positiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

module.exports = {
  compressStrategicAnswer,
  buildSummary,
  buildVoiceSummary,
  stripOperationalNoise,
  normalizeText,
  splitSentences,
  limitWords
};
