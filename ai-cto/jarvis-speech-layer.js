const {
  buildVoiceSummary,
  normalizeText,
  removeDanglingEnding,
  stripOperationalNoise
} = require('./strategic-compression-layer');

const DEFAULT_MAX_WORDS = 15;
const DEFAULT_MAX_CHARS = 180;

function buildJarvisSpeech({
  rawReasoning = '',
  summary = '',
  voiceSummary = '',
  fallback = ''
} = {}, options = {}) {
  const maxWords = positiveInt(options.maxWords, DEFAULT_MAX_WORDS);
  const maxChars = positiveInt(options.maxChars, DEFAULT_MAX_CHARS);
  const source = chooseSpeechSource({ voiceSummary, summary, rawReasoning, fallback });
  const cleaned = cleanSpeechText(source);
  const capped = capSpeech(cleaned, { maxWords, maxChars });

  return {
    voiceSummary: capped,
    spokenResponse: capped,
    source: source === voiceSummary ? 'voiceSummary' : source === summary ? 'summary' : source === rawReasoning ? 'rawReasoning' : 'fallback',
    limits: {
      maxWords,
      maxChars,
      estimatedSeconds: estimateSpeechSeconds(capped)
    }
  };
}

function chooseSpeechSource({ voiceSummary = '', summary = '', rawReasoning = '', fallback = '' } = {}) {
  return [voiceSummary, summary, rawReasoning, fallback]
    .map((item) => String(item || '').trim())
    .find(Boolean) || 'I need a clearer question.';
}

function cleanSpeechText(text = '') {
  const withoutOperationalNoise = stripOperationalNoise(text)
    .split('\n')
    .filter((line) => !/^(Objective|Assumption|Concern|Decision|Desired outcome|Strategic memory|Strategic frame|Route confidence|Current Founder Worldview|Previous Vision|Vision Shift):/i.test(line.trim()))
    .filter((line) => !/^(Founder Brain|Agent Council|Execution Layer|Advisor Mode|Reflection|Premortem|Contradiction|Route):/i.test(line.trim()))
    .join('\n');

  return normalizeText(withoutOperationalNoise)
    .replace(/\b(?:TASK_PLAN|APPROVE|EXECUTION_RESULT|AUDIT_REPORT|CLARIFICATION_REQUEST)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function capSpeech(text = '', { maxWords = DEFAULT_MAX_WORDS, maxChars = DEFAULT_MAX_CHARS } = {}) {
  const cleaned = cleanSpeechText(text);
  if (!cleaned) return 'I need a clearer question.';
  const wordCapped = buildVoiceSummary(cleaned, maxWords);
  const charCapped = wordCapped.length <= maxChars
    ? wordCapped
    : `${wordCapped.slice(0, Math.max(0, maxChars)).trim().replace(/[.?!,;:]+$/, '')}`;
  return removeDanglingEnding(charCapped).replace(/[.?!,;:]+$/, '');
}

function estimateSpeechSeconds(text = '') {
  const words = normalizeText(text).split(/\s+/).filter(Boolean).length;
  return Number(Math.max(1, words / 2.4).toFixed(1));
}

function assertJarvisSpeechSafe(text = '', options = {}) {
  const maxWords = positiveInt(options.maxWords, DEFAULT_MAX_WORDS);
  const maxSeconds = Number.isFinite(Number(options.maxSeconds)) ? Number(options.maxSeconds) : 15;
  const cleaned = normalizeText(text);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const forbidden = /\b(?:TASK_PLAN|APPROVE|Health|Momentum|Roadmap Agent|Product Judgment Agent|Execution Operator|Memory Sources Used|Route Confidence|Objective:|Assumption:|Concern:)\b/i;

  return {
    ok: Boolean(cleaned) &&
      words.length <= maxWords &&
      estimateSpeechSeconds(cleaned) <= maxSeconds &&
      !forbidden.test(cleaned),
    wordCount: words.length,
    estimatedSeconds: estimateSpeechSeconds(cleaned),
    hasFrameworkLeakage: forbidden.test(cleaned)
  };
}

function positiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

module.exports = {
  buildJarvisSpeech,
  chooseSpeechSource,
  cleanSpeechText,
  capSpeech,
  estimateSpeechSeconds,
  assertJarvisSpeechSafe
};
