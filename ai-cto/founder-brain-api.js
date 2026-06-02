const path = require('path');
const { routeMessageWithAi } = require('./whatsapp/command-router');
const { loadEngineeringState } = require('./whatsapp/state-reader');
const { readConversationMemory } = require('./whatsapp/memory-store');
const { workflowFreshness } = require('./whatsapp/diagnostics');
const {
  compressStrategicAnswer,
  buildVoiceSummary,
  stripOperationalNoise
} = require('./strategic-compression-layer');

const ROOT = path.resolve(__dirname, '..');
const MAX_CONFIDENCE = 0.9;

async function answerFounderBrainQuestion({
  question = '',
  state = null,
  memory = null,
  root = ROOT,
  publicBaseUrl = '',
  routeImpl = routeMessageWithAi
} = {}) {
  const normalizedQuestion = String(question || '').trim();
  if (!normalizedQuestion) {
    return {
      type: 'unclear',
      summary: 'No question was provided.',
      confidence: 0.2,
      rawReasoning: 'The Brain API requires a non-empty founder question before it can reconstruct intent.',
      voiceSummary: 'No question was provided.',
      sources: ['brain_api_input'],
      route: null
    };
  }

  const activeState = state || loadState();
  const activeMemory = memory || readConversationMemory();
  const route = await routeImpl(normalizedQuestion, activeState, activeMemory, {
    commit: false,
    push: false,
    deferLowRiskVisionExecution: true,
    root,
    publicBaseUrl
  });
  const rawReasoning = String(route && route.response ? route.response : '').trim();
  const compressed = compressStrategicAnswer(rawReasoning);
  const confidence = extractConfidence(route, rawReasoning);

  return {
    type: classifyBrainAnswerType(route, normalizedQuestion),
    summary: compressed.summary,
    confidence,
    rawReasoning: compressed.rawReasoning,
    voiceSummary: compressed.voiceSummary,
    compression: compressed.limits,
    sources: buildSources(route),
    route: {
      command: route && route.command ? route.command : null,
      matchedRoute: route && route.matchedRoute ? route.matchedRoute : null,
      intent: route && route.intent ? route.intent : null
    }
  };
}

function loadState() {
  const state = loadEngineeringState();
  state.workflowFreshness = workflowFreshness(state);
  return state;
}

function classifyBrainAnswerType(route = {}, question = '') {
  const command = String(route.command || '');
  const matchedRoute = String(route.matchedRoute || '');
  const text = String(question || '').toLowerCase();

  if (/(approval|execution|build|commit|fix|implement|vision_command)/i.test(command)) return 'execution';
  if (/(product|improvement|keyboard|feature|user|habit|retention)/i.test(command)) return 'product';
  if (/\b(strategy|doubt|dream|vision|focus|tradeoff|dangerous assumption|fail)\b/i.test(text) ||
      /\b(founder_mind|conversation|objective)\b/i.test(matchedRoute)) {
    return /\b(dream|vision|chasing|why am i|same founder|belief)\b/i.test(text) ? 'reflection' : 'strategy';
  }
  if (/\b(status|health|risk|summary)\b/i.test(command)) return 'status';
  return 'reflection';
}

function summarizeAnswer(answer = '') {
  return compressStrategicAnswer(answer).summary;
}

function stripOperationalHeaders(answer = '') {
  return stripOperationalNoise(answer).trim();
}

function extractConfidence(route = {}, answer = '') {
  const details = route.details || {};
  const candidates = [
    details.confidence,
    details.routeConfidence,
    details.founderState && details.founderState.confidence
  ];
  const match = String(answer || '').match(/Route Confidence:\s*(\d+)%/i);
  if (match) candidates.push(Number(match[1]));
  const numeric = candidates.find((value) => Number.isFinite(Number(value)));
  if (!Number.isFinite(Number(numeric))) return 0.72;
  const scaled = Number(numeric) > 1 ? Number(numeric) / 100 : Number(numeric);
  return Math.max(0.1, Math.min(MAX_CONFIDENCE, Number(scaled.toFixed(2))));
}

function toVoiceSummary(summary = '', maxLength = 240) {
  const voiceSummary = buildVoiceSummary(summary);
  if (voiceSummary.length <= maxLength) return voiceSummary;
  return `${voiceSummary.slice(0, Math.max(0, maxLength - 3)).trim().replace(/[.?!,;:]+$/, '')}...`;
}

function buildSources(route = {}) {
  const sources = new Set(['founder_memory', 'session_memory', 'whatsapp_router']);
  if (route && route.matchedRoute) sources.add(route.matchedRoute);
  if (route && route.details && route.details.founderState) sources.add('founder_state_detection');
  return [...sources];
}

module.exports = {
  answerFounderBrainQuestion,
  classifyBrainAnswerType,
  summarizeAnswer,
  stripOperationalHeaders,
  extractConfidence,
  toVoiceSummary,
  buildSources
};
