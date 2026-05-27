const fs = require('fs');
const path = require('path');
const {
  aggregateProductSignals,
  detectRepeatedPainPatterns,
  sanitizeProductSignals,
  summarizeFrictionSignals
} = require('./product-signal-pipeline');

const CACHE_FILE_NAME = 'local-product-learning-cache.json';
const MAX_ENTRIES = 48;
const MAX_TRUTHS = 24;
const MAX_REJECTED_EXPERIMENTS = 24;
const ENTRY_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const WEAK_CONFIDENCE_DECAY = 0.5;
const DROP_CONFIDENCE_BELOW = 0.25;

function updateProductPatternMemory({
  root = process.cwd(),
  samples = [],
  founderApprovedImprovement = null,
  rejectedExperiment = null,
  nowMs = Date.now()
} = {}) {
  const file = path.join(root, CACHE_FILE_NAME);
  const memory = loadProductPatternMemory(root);
  const aggregate = aggregateProductSignals(samples);
  const friction = summarizeFrictionSignals(aggregate.signals);
  const repeatedPain = detectRepeatedPainPatterns(aggregate.signals);
  const entry = buildEntry({ aggregate, friction, nowMs });

  const entries = decayEntries(memory.entries || [], nowMs);
  if (Object.keys(entry.signals).length > 0) {
    entries.push(entry);
  }

  const next = {
    schemaVersion: 1,
    updatedAtMs: nowMs,
    entries: entries.slice(-MAX_ENTRIES),
    founderApprovedImprovements: appendBounded(
      memory.founderApprovedImprovements,
      sanitizeLabel(founderApprovedImprovement),
      MAX_TRUTHS
    ),
    rejectedExperiments: appendBounded(
      memory.rejectedExperiments,
      sanitizeLabel(rejectedExperiment),
      MAX_REJECTED_EXPERIMENTS
    ),
    protections: {
      storesRawText: false,
      storesSwipePaths: false,
      canMutateHotPath: false,
      localOnly: true
    },
    repeatedPainSummary: repeatedPain
  };

  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
}

function loadProductPatternMemory(root = process.cwd()) {
  const file = path.join(root, CACHE_FILE_NAME);
  if (!fs.existsSync(file)) return emptyMemory();
  try {
    return normalizeMemory(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (_error) {
    return emptyMemory();
  }
}

function buildEntry({ aggregate, friction, nowMs }) {
  const signals = sanitizeProductSignals(aggregate.signals).signals;
  const repeatedPain = detectRepeatedPainPatterns(signals);
  const evidenceVolume = Object.values(signals).reduce((sum, value) => sum + value, 0);
  const repeatedPainVolume = (signals.correctionBursts || 0) +
    (signals.swipeFailureClusters || 0) +
    (signals.repeatedRetryPatterns || 0) +
    (signals.longWordSwipeAbandonment || 0);
  const confidence = repeatedPainVolume >= 8
    ? 0.85
    : evidenceVolume >= 30
      ? 0.75
      : evidenceVolume >= 12
        ? 0.55
        : evidenceVolume > 0
          ? 0.25
          : 0;
  return {
    observedAtMs: nowMs,
    confidence,
    signals,
    friction,
    repeatedPain,
    discardedAssumptions: aggregate.rejectedKeys.map((key) => `Rejected unsafe raw-content key: ${key}`)
  };
}

function decayEntries(entries, nowMs) {
  return entries
    .filter((entry) => nowMs - Number(entry.observedAtMs || 0) <= ENTRY_TTL_MS)
    .map((entry) => {
      const ageRatio = Math.max(0, (nowMs - Number(entry.observedAtMs || nowMs)) / ENTRY_TTL_MS);
      const confidence = Number(entry.confidence || 0);
      const decayedConfidence = confidence < 0.7
        ? confidence * WEAK_CONFIDENCE_DECAY * (1 - ageRatio)
        : confidence * (1 - ageRatio * 0.25);
      return {
        ...entry,
        confidence: Number(Math.max(0, decayedConfidence).toFixed(3))
      };
    })
    .filter((entry) => entry.confidence >= DROP_CONFIDENCE_BELOW);
}

function normalizeMemory(memory) {
  return {
    ...emptyMemory(),
    ...memory,
    entries: Array.isArray(memory.entries) ? memory.entries.slice(-MAX_ENTRIES) : [],
    founderApprovedImprovements: array(memory.founderApprovedImprovements).slice(-MAX_TRUTHS),
    rejectedExperiments: array(memory.rejectedExperiments).slice(-MAX_REJECTED_EXPERIMENTS)
  };
}

function emptyMemory() {
  return {
    schemaVersion: 1,
    updatedAtMs: 0,
    entries: [],
    founderApprovedImprovements: [],
    rejectedExperiments: [],
    protections: {
      storesRawText: false,
      storesSwipePaths: false,
      canMutateHotPath: false,
      localOnly: true
    }
  };
}

function appendBounded(items, item, limit) {
  const output = array(items);
  if (item) output.push(item);
  return output.slice(-limit);
}

function sanitizeLabel(value) {
  if (!value) return null;
  return String(value)
    .replace(/["'`].*?["'`]/g, '[redacted]')
    .replace(/\b(raw|text|sentence|phrase|word|keystroke|swipe path)\b/gi, '[redacted]')
    .slice(0, 120);
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  CACHE_FILE_NAME,
  MAX_ENTRIES,
  loadProductPatternMemory,
  updateProductPatternMemory
};
