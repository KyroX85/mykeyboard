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
  currentStage: 'Phase 1 protected foundation + Phase 2 Explain active. Phase 1 keyboard trust is protected; Explain is active for design, proposals, and Product Lab evidence.',
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
  const memoryItems = buildFounderMemoryItems(files);
  return {
    version: 'founder-memory-layer-v1',
    priority: 'FOUNDER_MEMORY_OVERRIDES_CONVERSATION_HISTORY',
    root,
    files,
    memoryItems,
    missing,
    confidence,
    audit: MEMORY_AUDIT,
    loadedAt: new Date().toISOString()
  };
}

function retrieveRelevantFounderMemories(question = '', memoryLayer = loadFounderMemoryLayer(), {
  limit = 5
} = {}) {
  const intent = inferRetrievalIntent(question);
  const items = Array.isArray(memoryLayer.memoryItems) && memoryLayer.memoryItems.length
    ? memoryLayer.memoryItems
    : buildFounderMemoryItems(memoryLayer.files || []);
  const ranked = items
    .map((item) => ({
      ...item,
      score: scoreMemoryItem(item, intent)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
    .slice(0, limit);

  return {
    query: String(question || ''),
    intent,
    strategy: 'concept_relevance_ranking',
    items: ranked,
    confidence: ranked.length >= 4 ? 86 : ranked.length >= 2 ? 74 : 55
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

function buildFounderMemoryItems(files = []) {
  const existing = new Map(files.filter((file) => file.exists).map((file) => [file.relativePath, file]));
  return [
    item('founder_goal_understand_before_typing', 'founder_goals', 'FOUNDER_VISION.md',
      'Aritenis should become a trusted local-first keyboard intelligence layer that helps users understand confusing content before they type.',
      ['vision', 'trust', 'explain', 'keyboard_layer', 'user_leverage', 'privacy']),
    item('founder_dream_phone_intelligence', 'founder_goals', 'FOUNDER_VISION.md',
      'The long-term dream is a keyboard-based intelligence layer inside daily phone workflows, not a generic chatbot or generic keyboard.',
      ['vision', 'dream', 'phone_operated_agents', 'user_leverage', 'companion_dna']),
    item('active_phase_protected_foundation', 'founder_current_phase', 'CURRENT_STAGE.md',
      'Current stage is Phase 1 protected foundation plus Phase 2 Explain active; foundation work must not damage typing trust.',
      ['phase', 'foundation_guard', 'explain', 'trust', 'stability']),
    item('current_blocker_killer_feature', 'founder_frustrations', 'CURRENT_STAGE.md',
      'The exact Phase 2 killer feature and first magical demo are not fully locked yet.',
      ['missing_piece', 'killer_feature', 'first_demo', 'explain', 'uncertainty']),
    item('active_hypothesis_explain_wedge', 'founder_current_phase', 'ACTIVE_HYPOTHESES.md',
      'Explain is the leading Phase 2 wedge: users may switch if Aritenis helps them understand confusing content before typing.',
      ['explain', 'killer_feature', 'user_leverage', 'differentiation']),
    item('active_hypothesis_screenshot_proof', 'founder_current_phase', 'ACTIVE_HYPOTHESES.md',
      'Screenshot understanding may be the first proof point, but it needs clean evidence and confirmation before action.',
      ['screenshot', 'first_demo', 'explain', 'evidence', 'privacy']),
    item('product_lab_reliability_gap', 'founder_frustrations', 'ACTIVE_HYPOTHESES.md',
      'Product Lab evidence must become reliable; black screens and System UI failures cannot support product judgment.',
      ['evidence', 'product_lab', 'screenshot', 'missing_piece', 'trust']),
    item('agent_understanding_gap', 'founder_frustrations', 'PROJECT_STATE.md',
      'Agents still answer from fragments and can fall back to rigid templates instead of reconstructing founder state.',
      ['agent_understanding', 'memory_retrieval', 'templates', 'missing_piece']),
    item('rejected_gboard_clone_strategy', 'founder_rejected_ideas', 'REJECTED_DIRECTIONS.md',
      'Better prediction, better swipe, themes, settings, and architecture cleanup are rejected as primary differentiators.',
      ['rejected', 'gboard_clone', 'foundation_guard', 'differentiation']),
    item('rejected_privacy_and_autonomy_risks', 'founder_rejected_ideas', 'REJECTED_DIRECTIONS.md',
      'Auto-send, silent app control, cloud telemetry, raw typing collection, and raw screenshot retention are rejected.',
      ['rejected', 'privacy', 'trust', 'execution_safety']),
    item('founder_decision_confirm_before_action', 'founder_decisions', 'FOUNDER_VISION.md',
      'Confirmation before action is mandatory; Explain can prepare help, but nothing should be sent automatically.',
      ['decision', 'privacy', 'execution_safety', 'explain'])
  ].filter((entry) => existing.has(entry.source));
}

function item(id, category, source, summary, concepts) {
  return { id, category, source, summary, concepts };
}

function inferRetrievalIntent(question = '') {
  const text = String(question || '').toLowerCase();
  const concepts = new Set(['vision']);
  if (/\bmissing|lack|gap|not enough|need|weak|wrong|off\b/.test(text)) {
    ['missing_piece', 'killer_feature', 'first_demo', 'uncertainty', 'agent_understanding', 'explain', 'user_leverage'].forEach((concept) => concepts.add(concept));
  }
  if (/\bdream|vision|chasing|goal|company|future\b/.test(text)) {
    ['dream', 'phone_operated_agents', 'user_leverage'].forEach((concept) => concepts.add(concept));
  }
  if (/\bexplain|screenshot|understand|confusing\b/.test(text)) {
    ['explain', 'screenshot', 'first_demo'].forEach((concept) => concepts.add(concept));
  }
  if (/\btrust|privacy|safe|protect|risk\b/.test(text)) {
    ['trust', 'privacy', 'foundation_guard', 'execution_safety'].forEach((concept) => concepts.add(concept));
  }
  if (/\bagent|memory|remember|context|retrieve\b/.test(text)) {
    ['agent_understanding', 'memory_retrieval', 'templates'].forEach((concept) => concepts.add(concept));
  }
  if (/\bbuild|avoid|not build|rejected|wrong thing\b/.test(text)) {
    ['rejected', 'gboard_clone', 'privacy'].forEach((concept) => concepts.add(concept));
  }
  return {
    concepts: [...concepts],
    needsStrategicGap: concepts.has('missing_piece') || concepts.has('killer_feature'),
    needsTrustBoundary: concepts.has('trust') || concepts.has('privacy')
  };
}

function scoreMemoryItem(item, intent) {
  const concepts = new Set(intent.concepts || []);
  let score = 0;
  for (const concept of item.concepts || []) {
    if (concepts.has(concept)) score += 10;
  }
  if (intent.needsStrategicGap && item.category === 'founder_frustrations') score += 8;
  if (intent.needsTrustBoundary && item.category === 'founder_rejected_ideas') score += 6;
  if (item.category === 'founder_goals') score += 3;
  if (item.category === 'founder_current_phase') score += 2;
  return score;
}

module.exports = {
  FOUNDER_MEMORY_FILES,
  MEMORY_AUDIT,
  buildFounderMemorySystemContext,
  formatMemoryAudit,
  loadFounderMemoryLayer,
  retrieveRelevantFounderMemories
};
