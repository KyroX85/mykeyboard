const { loadFounderMemoryLayer } = require('../founder-memory-layer');
const { formatRealityReconstruction } = require('../reality-reconstruction-layer');

function classifyFounderIntent(message = '') {
  const text = normalize(message);
  if (!text) return { intent: 'EMPTY', confidence: 0 };
  if (isExplicitExecution(text)) return { intent: 'EXECUTION_REQUEST', confidence: 0.9 };
  if (isFounderMemoryAudit(text)) return { intent: 'FOUNDER_MEMORY_AUDIT', confidence: 0.96 };
  if (isFounderMemoryQuestion(text)) return { intent: 'FOUNDER_MEMORY_QUESTION', confidence: 0.9 };
  return { intent: 'GENERAL_CONVERSATION', confidence: 0.4 };
}

function routeFounderMemoryIntent(message = '', { root } = {}) {
  const classification = classifyFounderIntent(message);
  if (!['FOUNDER_MEMORY_AUDIT', 'FOUNDER_MEMORY_QUESTION'].includes(classification.intent)) return null;
  const memoryLayer = loadFounderMemoryLayer({ root });
  return {
    command: classification.intent === 'FOUNDER_MEMORY_AUDIT' ? 'memory_audit' : 'founder_memory_question',
    details: {
      agent: 'cto',
      intent: classification.intent.toLowerCase(),
      confidence: memoryLayer.confidence,
      intentConfidence: classification.confidence
    },
    matchedRoute: 'founder_memory_intent',
    response: formatRealityReconstruction({
      question: message,
      root,
      memoryLayer
    })
  };
}

function formatFounderMemoryQuestion(message = '', memoryLayer = loadFounderMemoryLayer()) {
  return formatRealityReconstruction({
    question: message,
    memoryLayer
  });
}

function isFounderMemoryAudit(text) {
  return text === 'memory audit' ||
    /\b(project|founder|company|vision)\s+audit\b/.test(text) ||
    /\banswer only from memory\b/.test(text) ||
    /\bonly reconstruct project state\b/.test(text);
}

function isFounderMemoryQuestion(text) {
  if (!hasQuestionShape(text)) return false;
  return asksProduct(text) ||
    asksWhy(text) ||
    asksStage(text) ||
    asksBlocker(text) ||
    asksHypothesisOrWedge(text) ||
    asksRejected(text) ||
    asksDoNotBuild(text) ||
    asksThirtyDays(text) ||
    asksNext(text);
}

function isExplicitExecution(text) {
  const withoutNegatedInstructions = text
    .replace(/\bdo not (propose|execute|create|write|modify|edit|commit|push|implement|run|build)[^.?\n]*/g, '')
    .replace(/\bnever (propose|execute|create|write|modify|edit|commit|push|implement|run|build)[^.?\n]*/g, '');
  if (!withoutNegatedInstructions.trim()) return false;
  return /\b(implement|execute|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|fix now)\b/.test(withoutNegatedInstructions);
}

function hasQuestionShape(text) {
  return /\b(what|why|which|when|how|should|would|could|if|current|final|ultimate|active)\b/.test(text) || text.includes('?');
}

function asksProduct(text) {
  return /\b(what product|product are we building|what are we building|company building|aritenis building)\b/.test(text);
}

function asksWhy(text) {
  return /\b(why are we building|why building|ultimate user outcome|final goal|ultimate aim|company goal|north star|purpose)\b/.test(text);
}

function asksStage(text) {
  return /\b(phase|stage|current stage|company phase|where are we)\b/.test(text);
}

function asksBlocker(text) {
  return /\b(blocker|biggest unsolved problem|unsolved problem|current problem|current blocker)\b/.test(text);
}

function asksHypothesisOrWedge(text) {
  return /\b(active wedge|wedge|active hypothesis|hypothesis|feature are we searching|killer feature)\b/.test(text);
}

function asksRejected(text) {
  return /\b(rejected|already explored|mostly rejected|deprioritized|not pursuing)\b/.test(text);
}

function asksDoNotBuild(text) {
  return /\b(should not be built|what should not|should we not build|do not build|shouldn't build|not build right now|avoid building)\b/.test(text);
}

function asksThirtyDays(text) {
  return /\b(disappeared for 30 days|disappear for 30 days|absent for 30 days|if kaamesh disappeared|if founder disappeared)\b/.test(text);
}

function asksNext(text) {
  return /\b(next objective|continue working|work on next|what next)\b/.test(text);
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

module.exports = {
  classifyFounderIntent,
  formatFounderMemoryQuestion,
  routeFounderMemoryIntent
};
