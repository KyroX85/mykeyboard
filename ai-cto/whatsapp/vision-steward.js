const fs = require('fs');
const path = require('path');
const { loadEngineeringState } = require('./state-reader');
const { readRoadmap } = require('./roadmap-reader');
const { buildAgentCouncil, summarizeCouncil } = require('../orchestration/agent-council-engine');
const { buildNvidiaCouncil } = require('../orchestration/nvidia-council-engine');

const DEFAULT_STATE = {
  version: '1.0',
  sentToday: 0,
  day: '',
  lastSentAt: '',
  lastTopic: ''
};

function buildVisionStewardMessage({
  engineeringState = loadEngineeringState(),
  roadmap = readRoadmap(),
  now = new Date()
} = {}) {
  const pressure = inferHighestVisionPressure(engineeringState, roadmap);
  const suggestion = buildSafeSuggestion(pressure);
  const council = summarizeCouncil(buildAgentCouncil(suggestion));
  return [
    'Founder, one vision check.',
    '',
    `Company goal: ${roadmap.northStar || 'help users understand confusing content before they type.'}`,
    `Current pressure: ${pressure.summary}`,
    `Council consensus: ${council.consensus}`,
    `Council dissent: ${council.dissent}`,
    `Suggested improvement: ${suggestion}`,
    'Execution: no code change started. This is a proposal only; I need your approval before implementation.'
  ].join('\n');
}

async function buildVisionStewardMessageWithModelCouncil({
  engineeringState = loadEngineeringState(),
  roadmap = readRoadmap(),
  now = new Date(),
  nvidiaClient
} = {}) {
  const pressure = inferHighestVisionPressure(engineeringState, roadmap);
  const suggestion = buildSafeSuggestion(pressure);
  const council = await buildNvidiaCouncil({
    proposal: [
      `Proactive Aritenis vision suggestion: ${suggestion}`,
      `Company goal: ${roadmap.northStar || 'help users understand confusing content before they type.'}`,
      `Current pressure: ${pressure.summary}`,
      'Judge whether this should be sent to the founder as a calm proposal. Do not start execution.'
    ].join(' '),
    client: nvidiaClient
  });
  const summary = council.summary || {};
  return [
    'Founder, one vision check.',
    '',
    `Company goal: ${roadmap.northStar || 'help users understand confusing content before they type.'}`,
    `Current pressure: ${pressure.summary}`,
    `Model council: ${council.mode === 'NVIDIA_MODEL_COUNCIL' ? `${summary.modelCount || 0} NVIDIA opinions` : `fallback - ${summary.fallbackReason}`}`,
    `Council consensus: ${summary.consensus}`,
    `Council dissent: ${summary.dissent}`,
    `Suggested improvement: ${suggestion}`,
    'Execution: no code change started. This is a proposal only; I need your approval before implementation.'
  ].join('\n');
}

function inferHighestVisionPressure(state = {}, roadmap = {}) {
  const sections = state.sections || {};
  const risks = [
    ...array(sections.risks),
    ...array(sections.unresolved),
    ...array(sections.approvals)
  ].filter(Boolean);
  const text = risks.join(' ').toLowerCase();

  if (/screenshot|product lab|visual|image|artifact|system ui|not responding|black screen/.test(text)) {
    return {
      topic: 'screenshot_explain_evidence',
      summary: 'screenshot evidence is still the weakest link for Explain because bad visual evidence can mislead product judgment.'
    };
  }
  if (/explain|phase 2|execution layer|glass handle/.test(text)) {
    return {
      topic: 'explain_wedge',
      summary: 'Phase 2 depends on making Explain feel useful without damaging the protected keyboard foundation.'
    };
  }
  if (/typing|swipe|prediction|latency|keyboard|stability/.test(text)) {
    return {
      topic: 'foundation_guard',
      summary: 'foundation trust still needs protection before any Explain or execution-layer expansion.'
    };
  }
  return {
    topic: 'explain_wedge',
    summary: roadmap.currentPhase
      ? `${roadmap.currentPhase} should stay focused on Explain, not generic agent or architecture work.`
      : 'Phase 2 should stay focused on Explain, not generic agent or architecture work.'
  };
}

function buildSafeSuggestion(pressure = {}) {
  if (pressure.topic === 'screenshot_explain_evidence') {
    return 'make the Product Lab reject unusable screenshots and capture one clean keyboard visual before judging UI quality.';
  }
  if (pressure.topic === 'foundation_guard') {
    return 'keep protected keyboard files stable and use evidence-only proposals for any foundation change.';
  }
  return 'define the smallest Explain wedge: user-triggered screenshot -> short explanation -> ready/confirm/cancel, with no auto-send.';
}

function shouldSendProactiveVisionUpdate({
  root = process.cwd(),
  now = new Date(),
  minHoursBetween = 6,
  maxPerDay = 2,
  enabled = process.env.CTO_PROACTIVE_STEWARD_ENABLED !== 'false'
} = {}) {
  if (!enabled) return { allowed: false, reason: 'disabled' };
  const state = readProactiveState(root);
  const day = dateKey(now);
  const normalized = state.day === day ? state : { ...DEFAULT_STATE, day };
  if (normalized.sentToday >= maxPerDay) return { allowed: false, reason: 'daily_limit', state: normalized };
  if (normalized.lastSentAt) {
    const elapsedHours = (now.getTime() - new Date(normalized.lastSentAt).getTime()) / 36e5;
    if (Number.isFinite(elapsedHours) && elapsedHours < minHoursBetween) {
      return { allowed: false, reason: 'cooldown', state: normalized };
    }
  }
  return { allowed: true, reason: 'ready', state: normalized };
}

function recordProactiveVisionUpdate({
  root = process.cwd(),
  now = new Date(),
  topic = ''
} = {}) {
  const state = readProactiveState(root);
  const day = dateKey(now);
  const normalized = state.day === day ? state : { ...DEFAULT_STATE, day, sentToday: 0 };
  const next = {
    ...normalized,
    version: '1.0',
    day,
    sentToday: Number(normalized.sentToday || 0) + 1,
    lastSentAt: now.toISOString(),
    lastTopic: topic
  };
  fs.mkdirSync(path.dirname(proactiveStatePath(root)), { recursive: true });
  fs.writeFileSync(proactiveStatePath(root), JSON.stringify(next, null, 2));
  return next;
}

function readProactiveState(root = process.cwd()) {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(proactiveStatePath(root), 'utf8')) };
  } catch {
    return { ...DEFAULT_STATE, day: dateKey(new Date()) };
  }
}

function proactiveStatePath(root = process.cwd()) {
  return path.join(root, 'ai-cto', '.proactive-vision-steward.json');
}

function dateKey(value) {
  return value.toISOString().slice(0, 10);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  buildVisionStewardMessage,
  buildVisionStewardMessageWithModelCouncil,
  inferHighestVisionPressure,
  shouldSendProactiveVisionUpdate,
  recordProactiveVisionUpdate,
  readProactiveState,
  proactiveStatePath
};
