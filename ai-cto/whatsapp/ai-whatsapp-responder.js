const { createNvidiaClient, MODEL_ASSIGNMENT } = require('./nvidia-nim-client');
const { readActionLog } = require('./agent-action-log');
const { readRoadmap } = require('./roadmap-reader');
const { readFounderMemory, buildFounderMemoryContext } = require('./founder-memory');
const { buildFounderMemorySystemContext, loadFounderMemoryLayer } = require('../founder-memory-layer');

const MAX_LLAMA_CALLS_PER_DAY = 100;
const LLAMA_RESPONSE_TIMEOUT_MS = Number(process.env.LLAMA_RESPONSE_TIMEOUT_MS || 8000);

const AGENT_PERSONALITIES = {
  cto: 'CTO: You are calm, strategic, and decisive. Sound like a real startup CTO reporting to their CEO.',
  coder: 'CODER: You are technical, focused, and practical. Report what changed, what is blocked, and what comes next.',
  reviewer: 'REVIEWER: You are careful, thorough, and cautious. Keep safety and regression risk clear.',
  auditor: 'AUDITOR: You are serious, alert, and no-nonsense. Security and stability are the priority.'
};

function buildAiWhatsAppPrompt({ founderMessage, agent = 'cto', state = {}, memory = {}, roadmap = readRoadmap() }) {
  const recentActions = readRecentActions();
  const recentMessages = Array.isArray(memory.recentMessages) ? memory.recentMessages.slice(-10) : [];
  const founderMemory = buildFounderMemoryContext(readFounderMemory());
  const founderMemoryLayer = memory.founderMemoryLayer || loadFounderMemoryLayer();
  const sections = state.sections || {};
  const system = [
    buildFounderMemorySystemContext(founderMemoryLayer),
    '',
    'You are using Llama 3.3 70B as the Conversation Brain for Aritenis AI.',
    'You are the CTO of Aritenis, an Android keyboard with a protected typing foundation and an emerging Explain-first understanding layer.',
    'You report to the founder who built this product.',
    'You lead a team of 3 agents: Coder, Reviewer, Auditor.',
    'You are professional and respectful. You are warm, direct, and honest.',
    'English only. Do not use Tamil words, Tanglish, slang, casual greetings, or informal nicknames.',
    'Never use these words: da, pa, anna, machi, paathu, vanakkam.',
    'Address the founder as Founder when needed, not by name. Do not use "sir" in every sentence.',
    'The CTO should sound like a real startup CTO reporting to their CEO.',
    'You never give false confidence. You never invent progress. You stay grounded in repo state.',
    `Current repo health: ${state.healthScore == null ? 'unknown' : state.healthScore}`,
    `Current phase: ${firstLine(roadmap.currentPhase || 'unknown')}`,
    `Founder preferences: ${JSON.stringify(founderMemory.founder_preferences)}`,
    `Product context: ${JSON.stringify(founderMemory.product_context)}`,
    `Recent activity: ${recentActions.join(' | ') || 'No recent action recorded.'}`,
    `Active risks: ${array(sections.risks).concat(array(sections.unresolved)).slice(0, 3).join(' | ') || 'No active risk recorded.'}`,
    `Pending approvals: ${array(sections.approvals).slice(0, 3).join(' | ') || 'none recorded'}`,
    AGENT_PERSONALITIES[agent] || AGENT_PERSONALITIES.cto,
    'If greeting: warm team response.',
    'If status question: honest current state.',
    'If technical question: route to right agent.',
    'If approval needed: present 3 clear options.',
    'Keep it short. This is WhatsApp, not email.'
  ].join('\n');

  const user = [
    `Founder message: ${founderMessage || ''}`,
    `Detected agent: ${agent}`,
    `Last 10 messages with full context: ${JSON.stringify(recentMessages)}`,
    `Last 5 decision history entries: ${JSON.stringify(founderMemory.recent_decisions)}`,
    `Last 3 conversation summaries: ${JSON.stringify(founderMemory.recent_conversation_summaries)}`,
    'Use the conversation history. Never ask for information already mentioned by the founder or by an agent.',
    `Top risk: ${(state.summary && state.summary.topRisk) || first(array(sections.risks)) || 'none recorded'}`,
    `Momentum: ${state.momentum || 'unknown'}`
  ].join('\n');

  return { system, user };
}

async function maybeGenerateAiWhatsAppResponse({ founderMessage, routed, fallbackResponse, state, memory, client = createNvidiaClient() }) {
  if (!client.available('llama')) {
    return { usedAi: false, response: fallbackResponse, reason: 'NVIDIA_LLAMA_API_KEY missing.' };
  }
  if (dailyLlamaCalls() >= MAX_LLAMA_CALLS_PER_DAY) {
    return { usedAi: false, response: fallbackResponse, reason: 'Daily Llama call limit reached.' };
  }

  const prompt = buildAiWhatsAppPrompt({
    founderMessage,
    agent: routed.agent || (routed.details && routed.details.agent) || 'cto',
    state,
    memory
  });
  const result = await withTimeout(
    client.chat('llama', [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ], {
      reason: 'WhatsApp conversation response',
      maxTokens: 500,
      temperature: 0.35
    }),
    LLAMA_RESPONSE_TIMEOUT_MS
  ).catch((error) => ({
    ok: false,
    reason: error.message || 'Llama response timeout.'
  }));

  if (!result.ok || !result.content) {
    return { usedAi: false, response: fallbackResponse, reason: result.reason || result.error || 'Llama response unavailable.' };
  }
  return {
    usedAi: true,
    response: limitWhatsApp(result.content),
    model: MODEL_ASSIGNMENT.llama.model,
    usage: result.usage
  };
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Llama response timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function dailyLlamaCalls(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return readActionLog().actions.filter((entry) =>
    String(entry.timestamp || '').startsWith(day) &&
    String(entry.outcome || '').includes(MODEL_ASSIGNMENT.llama.model)
  ).length;
}

function readRecentActions() {
  return readActionLog().actions
    .slice(-5)
    .reverse()
    .map((entry) => `${entry.agentName}: ${entry.actionTaken} -> ${entry.outcome}`)
    .slice(0, 5);
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/)[0].slice(0, 160);
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function limitWhatsApp(text) {
  const cleaned = String(text || '').trim();
  return cleaned.length > 1200 ? `${cleaned.slice(0, 1197)}...` : cleaned;
}

module.exports = {
  MAX_LLAMA_CALLS_PER_DAY,
  LLAMA_RESPONSE_TIMEOUT_MS,
  buildAiWhatsAppPrompt,
  maybeGenerateAiWhatsAppResponse
};
