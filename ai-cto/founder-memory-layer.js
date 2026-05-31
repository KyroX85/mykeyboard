const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FOUNDER_MEMORY_FILES = [
  'FOUNDER_VISION.md',
  'PROJECT_STATE.md',
  'CURRENT_STAGE.md',
  'REJECTED_DIRECTIONS.md',
  'ACTIVE_HYPOTHESES.md'
];

const MEMORY_AUDIT = {
  product: 'Aritenis is an Android keyboard with a protected typing foundation and a Phase 2 understanding/execution layer.',
  why: 'To help users understand confusing content before they type while preserving keyboard trust, privacy, and stability.',
  currentStage: 'Phase 2 preparation / early Phase 2. Phase 1 keyboard foundation is protected.',
  currentBlocker: 'The exact Phase 2 killer feature and first magical demo are not fully locked; Explain is the leading hypothesis.',
  activeHypothesis: 'Explain: user sees confusing content, opens Aritenis, gets a clear explanation, and only then confirms any reply/action.',
  rejectedDirections: [
    'better prediction/swipe/themes as the main differentiator',
    'emotional companion as the immediate active implementation path',
    'auto-send or silent app control',
    'cloud telemetry or raw typing/screenshot retention',
    'architecture sophistication without user leverage'
  ],
  nextObjective: 'Make founder memory consistent across WhatsApp agents and Codex before adding more features.'
};

function loadFounderMemoryLayer({ root = ROOT } = {}) {
  const files = FOUNDER_MEMORY_FILES.map((relativePath) => readMemoryFile(root, relativePath));
  const missing = files.filter((file) => !file.exists).map((file) => file.relativePath);
  const confidence = calculateConfidence(files);
  return {
    version: 'founder-memory-layer-v1',
    priority: 'FOUNDER_MEMORY_OVERRIDES_CONVERSATION_HISTORY',
    root,
    files,
    missing,
    confidence,
    audit: MEMORY_AUDIT,
    loadedAt: new Date().toISOString()
  };
}

function buildFounderMemorySystemContext(memoryLayer = loadFounderMemoryLayer()) {
  return [
    'Founder memory has higher priority than conversation history.',
    `Memory confidence: ${memoryLayer.confidence}%`,
    memoryLayer.confidence < 90 ? 'I do not have enough founder context.' : '',
    '',
    'Canonical founder memory:',
    ...memoryLayer.files
      .filter((file) => file.exists)
      .map((file) => `--- ${file.relativePath} ---\n${file.text.slice(0, 1800)}`)
  ].filter(Boolean).join('\n');
}

function formatMemoryAudit(memoryLayer = loadFounderMemoryLayer()) {
  const audit = memoryLayer.audit;
  return [
    'Founder memory audit',
    '',
    memoryLayer.confidence < 90 ? 'I do not have enough founder context.' : `Founder context confidence: ${memoryLayer.confidence}%`,
    memoryLayer.missing.length ? `Missing memory files: ${memoryLayer.missing.join(', ')}` : 'Missing memory files: none',
    '',
    `What are we building? ${audit.product}`,
    `Why are we building it? ${audit.why}`,
    `Current stage: ${audit.currentStage}`,
    `Current blocker: ${audit.currentBlocker}`,
    `Current active hypothesis: ${audit.activeHypothesis}`,
    'Rejected directions:',
    ...audit.rejectedDirections.map((item) => `- ${item}`),
    `Next objective: ${audit.nextObjective}`,
    '',
    'Rule: founder memory overrides conversation history. Do not invent roadmap items.'
  ].join('\n');
}

function readMemoryFile(root, relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    const text = fs.readFileSync(fullPath, 'utf8');
    return {
      relativePath,
      fullPath,
      exists: true,
      text
    };
  } catch {
    return {
      relativePath,
      fullPath,
      exists: false,
      text: ''
    };
  }
}

function calculateConfidence(files) {
  if (!files.length) return 0;
  const existing = files.filter((file) => file.exists && file.text.trim().length > 80).length;
  return Math.round((existing / files.length) * 100);
}

module.exports = {
  FOUNDER_MEMORY_FILES,
  MEMORY_AUDIT,
  buildFounderMemorySystemContext,
  formatMemoryAudit,
  loadFounderMemoryLayer
};
