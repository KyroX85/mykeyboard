const { loadFounderMemoryLayer, retrieveRelevantFounderMemories } = require('./founder-memory-layer');
const {
  retrieveActiveVision,
  formatVisionMemoryForResponse
} = require('./vision-memory-engine');

const DREAM_MODEL = {
  longTermVision: 'Aritenis becomes a trusted phone-native intelligence layer that helps people understand and act inside daily workflows.',
  personalAiEcosystemAmbition: 'The founder is chasing a personal AI ecosystem that can operate through the phone, WhatsApp agents, screenshots, keyboard context, and safe execution gates.',
  intelligenceLayerAmbition: 'The intelligence layer should understand context and help complete useful actions, while staying private, controlled, and evidence-grounded.',
  keyboardAsVehicle: 'The keyboard is the entry point because it sits inside the moment before communication and action.',
  founderMotivations: [
    'build something people would miss if it disappeared',
    'move beyond a Gboard clone into user leverage',
    'create a Jarvis-style product without losing trust or privacy',
    'make agents useful during founder absence without turning them into reckless executors'
  ],
  activeBridge: 'Phase 2 Explain is the current bridge from protected keyboard foundation to the larger dream.'
};

function buildDreamAlignment({
  question = '',
  task = '',
  root,
  memoryLayer = loadFounderMemoryLayer({ root }),
  visionMemory = null
} = {}) {
  const currentTask = inferCurrentTask(question || task);
  const retrieval = retrieveRelevantFounderMemories(question || task, memoryLayer, { limit: 5 });
  const projectGoal = 'Protect the trusted keyboard foundation while proving Explain: understanding confusing content before typing.';
  const activeVision = retrieveActiveVision(visionMemory);
  const founderDream = activeVision.currentFounderVision || DREAM_MODEL.longTermVision;
  const alignment = classifyAlignment(currentTask, retrieval);

  return {
    currentTask,
    projectGoal,
    founderDream,
    activeVision,
    alignment,
    dreamModel: DREAM_MODEL,
    relevantMemories: retrieval.items,
    summary: `${currentTask} -> ${projectGoal} -> ${founderDream}`
  };
}

function formatDreamAlignment(alignment = {}) {
  const lines = [
    'Dream alignment:',
    `- Current task: ${alignment.currentTask || 'unknown'}`,
    `- Project goal: ${alignment.projectGoal || 'unknown'}`,
    `- Founder dream: ${alignment.founderDream || 'unknown'}`,
    `- Alignment: ${alignment.alignment || 'unknown'}`
  ];
  const vision = formatVisionMemoryForResponse(alignment.activeVision);
  if (vision) {
    lines.push('');
    lines.push(vision);
  }
  return lines.join('\n');
}

function inferCurrentTask(text = '') {
  const value = String(text || '').toLowerCase();
  if (/\bmissing|gap|wrong thing|off|satisfied|dream|chasing\b/.test(value)) {
    return 'Reconstruct the strategic gap between current work and the founder dream.';
  }
  if (/\bexplain|screenshot|understand|confusing\b/.test(value)) {
    return 'Clarify or advance the Explain wedge without damaging keyboard trust.';
  }
  if (/\bprivacy|store|telemetry|raw|safe|trust\b/.test(value)) {
    return 'Protect trust boundaries so intelligence does not become creepy or unsafe.';
  }
  if (/\bagent|memory|understand|template|keyword\b/.test(value)) {
    return 'Improve agent understanding so the operating layer can support founder absence.';
  }
  if (/\bphase|roadmap|goal|company|build\b/.test(value)) {
    return 'Keep roadmap decisions connected to the active Phase 2 Explain direction.';
  }
  return 'Answer the founder in a way that connects immediate work to product leverage.';
}

function classifyAlignment(currentTask, retrieval = {}) {
  const text = `${currentTask} ${(retrieval.items || []).map((item) => item.id).join(' ')}`.toLowerCase();
  if (/privacy|trust|protect/.test(text)) return 'aligned if it preserves trust while enabling useful intelligence';
  if (/explain|screenshot|killer|missing|dream/.test(text)) return 'directly aligned with Phase 2 differentiation';
  if (/agent|memory|template/.test(text)) return 'supporting alignment; useful only if it improves product judgment';
  return 'needs evidence; do not treat it as aligned by default';
}

module.exports = {
  DREAM_MODEL,
  buildDreamAlignment,
  formatDreamAlignment,
  inferCurrentTask,
  classifyAlignment
};
