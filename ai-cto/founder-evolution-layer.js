const fs = require('fs');
const path = require('path');

const EVOLUTION_STATE_FILE = '.founder-evolution.json';
const EVOLUTION_MARKDOWN_FILE = 'FOUNDER_EVOLUTION.md';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const BASELINE_EVOLUTION = {
  version: 'founder-evolution-v1',
  founderModelRule: 'Founder identity must evolve; do not freeze old goals, frustrations, or hypotheses.',
  founderGoals: [
    'Build Aritenis into a trusted phone-native intelligence layer, using the keyboard as the entry point.',
    'Protect the Phase 1 keyboard foundation while proving Phase 2 Explain creates user leverage.'
  ],
  currentPhase: 'Phase 1 protected foundation + Phase 2 Explain active.',
  activeFrustrations: [
    'Agents can still feel template-driven instead of genuinely understanding founder intent.',
    'Product Lab evidence and screenshot reliability must be good enough before visual judgment is trusted.'
  ],
  activeHypotheses: [
    'Explain is the leading Phase 2 wedge: users may switch if Aritenis helps them understand confusing content before typing.',
    'Screenshot-powered understanding may become the first magical demo if privacy and evidence quality are preserved.'
  ],
  rejectedPaths: [
    'Generic Gboard clone strategy based on prediction, themes, settings, or swipe claims.',
    'Architecture theatre, fake progress, emotional companion simulation, auto-send, cloud telemetry, and raw typing or screenshot retention.'
  ],
  lastUpdatedAt: null,
  nextReviewDueAt: null,
  confidence: 72
};

function loadFounderEvolution({ root = process.cwd() } = {}) {
  const file = path.join(root, 'ai-cto', EVOLUTION_STATE_FILE);
  try {
    if (!fs.existsSync(file)) return { ...BASELINE_EVOLUTION, source: 'baseline' };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeEvolution({
      ...BASELINE_EVOLUTION,
      ...parsed,
      source: file
    });
  } catch {
    return { ...BASELINE_EVOLUTION, source: 'baseline_recovered' };
  }
}

function updateFounderEvolution({
  root = process.cwd(),
  now = new Date(),
  memoryAudit = {},
  conversationMemory = {},
  force = false
} = {}) {
  const current = loadFounderEvolution({ root });
  if (!force && !shouldUpdateFounderEvolution(current, now)) {
    return {
      updated: false,
      reason: 'not_due',
      evolution: current
    };
  }

  const snapshot = buildFounderEvolutionSnapshot({
    now,
    memoryAudit,
    conversationMemory,
    previousEvolution: current
  });

  const stateFile = path.join(root, 'ai-cto', EVOLUTION_STATE_FILE);
  const markdownFile = path.join(root, 'ai-cto', EVOLUTION_MARKDOWN_FILE);
  fs.writeFileSync(stateFile, JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(markdownFile, formatFounderEvolutionMarkdown(snapshot));
  return {
    updated: true,
    reason: force ? 'forced' : 'weekly_due',
    evolution: snapshot
  };
}

function buildFounderEvolutionSnapshot({
  now = new Date(),
  memoryAudit = {},
  conversationMemory = {},
  previousEvolution = BASELINE_EVOLUTION
} = {}) {
  const founderGoals = uniqueNonEmpty([
    ...asArray(previousEvolution.founderGoals),
    memoryAudit.product,
    memoryAudit.why,
    ...asArray(conversationMemory.founderGoals).map((entry) => entry.desiredOutcome || entry.objective)
  ]).slice(0, 8);

  const activeFrustrations = uniqueNonEmpty([
    memoryAudit.currentBlocker,
    ...asArray(previousEvolution.activeFrustrations),
    ...asArray(conversationMemory.founderDoubts).map((entry) => entry.concern || entry.objective),
    ...asArray(conversationMemory.founderConcerns).map((entry) => entry.concern || entry.objective),
    conversationMemory.currentFrustration,
    conversationMemory.unresolvedConcern
  ]).slice(0, 8);

  const activeHypotheses = uniqueNonEmpty([
    memoryAudit.activeHypothesis,
    ...asArray(previousEvolution.activeHypotheses),
    ...asArray(conversationMemory.recentMessages).map((entry) => hypothesisFromMessage(entry))
  ]).slice(0, 8);

  const rejectedPaths = uniqueNonEmpty([
    ...asArray(memoryAudit.rejectedDirections),
    ...asArray(previousEvolution.rejectedPaths),
    ...asArray(conversationMemory.founderRejectedPatterns),
    ...asArray(conversationMemory.fakeProgressPatterns)
  ]).slice(0, 10);

  return normalizeEvolution({
    version: 'founder-evolution-v1',
    founderModelRule: BASELINE_EVOLUTION.founderModelRule,
    founderGoals,
    currentPhase: memoryAudit.currentStage || previousEvolution.currentPhase || BASELINE_EVOLUTION.currentPhase,
    activeFrustrations,
    activeHypotheses,
    rejectedPaths,
    lastUpdatedAt: now.toISOString(),
    nextReviewDueAt: new Date(now.getTime() + WEEK_MS).toISOString(),
    confidence: calculateEvolutionConfidence({ founderGoals, activeFrustrations, activeHypotheses, rejectedPaths })
  });
}

function shouldUpdateFounderEvolution(evolution = {}, now = new Date()) {
  if (!evolution.lastUpdatedAt) return true;
  const last = Date.parse(evolution.lastUpdatedAt);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= WEEK_MS;
}

function formatFounderEvolutionMarkdown(evolution = BASELINE_EVOLUTION) {
  const normalized = normalizeEvolution(evolution);
  return [
    '# Founder Evolution',
    '',
    normalized.founderModelRule,
    '',
    `Last updated: ${normalized.lastUpdatedAt || 'not yet updated'}`,
    `Next review due: ${normalized.nextReviewDueAt || 'unknown'}`,
    `Confidence: ${normalized.confidence}%`,
    '',
    '## Founder Goals',
    ...normalized.founderGoals.map((item) => `- ${item}`),
    '',
    '## Current Phase',
    normalized.currentPhase,
    '',
    '## Active Frustrations',
    ...normalized.activeFrustrations.map((item) => `- ${item}`),
    '',
    '## Active Hypotheses',
    ...normalized.activeHypotheses.map((item) => `- ${item}`),
    '',
    '## Rejected Paths',
    ...normalized.rejectedPaths.map((item) => `- ${item}`),
    '',
    '## Operating Rule',
    'Before proposing work, check whether the founder model has changed this week. If confidence is weak, ask a useful diagnostic question instead of assuming old preferences.'
  ].join('\n');
}

function buildFounderEvolutionContext(evolution = BASELINE_EVOLUTION) {
  const normalized = normalizeEvolution(evolution);
  return [
    'Founder evolution layer:',
    `- Rule: ${normalized.founderModelRule}`,
    `- Current phase: ${normalized.currentPhase}`,
    `- Active frustration: ${normalized.activeFrustrations[0] || 'unknown'}`,
    `- Active hypothesis: ${normalized.activeHypotheses[0] || 'unknown'}`,
    `- Rejected path: ${normalized.rejectedPaths[0] || 'unknown'}`,
    `- Confidence: ${normalized.confidence}%`
  ].join('\n');
}

function normalizeEvolution(evolution = {}) {
  return {
    ...BASELINE_EVOLUTION,
    ...evolution,
    founderGoals: uniqueNonEmpty(evolution.founderGoals || BASELINE_EVOLUTION.founderGoals),
    activeFrustrations: uniqueNonEmpty(evolution.activeFrustrations || BASELINE_EVOLUTION.activeFrustrations),
    activeHypotheses: uniqueNonEmpty(evolution.activeHypotheses || BASELINE_EVOLUTION.activeHypotheses),
    rejectedPaths: uniqueNonEmpty(evolution.rejectedPaths || BASELINE_EVOLUTION.rejectedPaths),
    confidence: Math.min(90, Number(evolution.confidence || BASELINE_EVOLUTION.confidence))
  };
}

function calculateEvolutionConfidence({ founderGoals, activeFrustrations, activeHypotheses, rejectedPaths }) {
  let score = 45;
  if (founderGoals.length >= 2) score += 12;
  if (activeFrustrations.length >= 2) score += 12;
  if (activeHypotheses.length >= 2) score += 12;
  if (rejectedPaths.length >= 3) score += 9;
  return Math.min(90, score);
}

function hypothesisFromMessage(entry = {}) {
  const text = `${entry.summary || ''} ${entry.founderMessage || ''}`.toLowerCase();
  if (/explain|screenshot|understand/.test(text)) {
    return 'Explain remains the active wedge when it produces clear understanding before typing.';
  }
  if (/wrong thing|direction|killer/.test(text)) {
    return 'The active hypothesis must be tested against the killer user moment, not infrastructure progress.';
  }
  return null;
}

function uniqueNonEmpty(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of asArray(items)) {
    const value = String(item || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

module.exports = {
  BASELINE_EVOLUTION,
  EVOLUTION_MARKDOWN_FILE,
  EVOLUTION_STATE_FILE,
  buildFounderEvolutionContext,
  buildFounderEvolutionSnapshot,
  formatFounderEvolutionMarkdown,
  loadFounderEvolution,
  shouldUpdateFounderEvolution,
  updateFounderEvolution
};
