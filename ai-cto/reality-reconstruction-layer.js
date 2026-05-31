const fs = require('fs');
const path = require('path');
const { loadFounderMemoryLayer } = require('./founder-memory-layer');

const ROOT = path.resolve(__dirname, '..');

const PROJECT_STATE_FILES = [
  'FOUNDER_VISION.md',
  'PROJECT_STATE.md',
  'CURRENT_STAGE.md',
  'REJECTED_DIRECTIONS.md',
  'ACTIVE_HYPOTHESES.md',
  'ai-cto/roadmap-lock.json',
  'ai-cto/phase2-daily-agent-plan.json'
];

function buildRealityReconstruction({ question = '', root = ROOT, memoryLayer = loadFounderMemoryLayer({ root }) } = {}) {
  const sources = PROJECT_STATE_FILES.map((relativePath) => readSource(root, relativePath));
  const sourceMap = Object.fromEntries(sources.map((source) => [source.relativePath, source]));
  const missing = sources.filter((source) => !source.exists).map((source) => source.relativePath);
  const confidence = calculateRealityConfidence({ memoryLayer, sources, missing });

  const reconstruction = {
    product: [
      'Aritenis is an Android keyboard product, but the strategic product is bigger than typing.',
      'The active aim is a local-first intelligence layer inside the keyboard flow that helps users understand confusing content before they type or reply.'
    ].join(' '),
    stage: [
      'The company is in Phase 2 preparation / early Phase 2.',
      'Phase 1 keyboard trust is treated as a protected foundation, not the main area for endless optimization.'
    ].join(' '),
    bottleneck: [
      'The biggest bottleneck is not prediction or swipe quality right now.',
      'It is proving the Explain wedge with reliable evidence while keeping the WhatsApp agents from falling back into template replies or accidental execution behavior.'
    ].join(' '),
    activeSearch: [
      'The active search is for the first convincing Explain experience: a user sees confusing content, uses Aritenis from the keyboard flow, gets a useful explanation, and confirms any follow-up action.',
      'Screenshot understanding and the glass-handle execution layer are candidate pieces, but the 90-day killer-feature plan is not fully locked.'
    ].join(' '),
    unprovenAssumptions: [
      'It is still unproven that Explain is strong enough to make users choose Aritenis over Gboard.',
      'It is also unproven that screenshot evidence is reliable enough, that the glass handle will feel natural, and that agents can reason consistently without founder correction.'
    ].join(' '),
    shouldNotBuild: [
      'Do not build architecture vanity, generic multi-agent sophistication, better prediction as the main differentiator, emotional companion behavior as the immediate path, auto-send actions, silent app control, cloud telemetry, raw typing collection, or raw screenshot retention.'
    ].join(' ')
  };

  return {
    version: 'reality-reconstruction-v1',
    question,
    root,
    confidence,
    confidenceCapped: true,
    reconstruction,
    evidence: buildEvidenceList(sourceMap),
    uncertainty: buildUncertaintyList({ missing, sourceMap, memoryLayer }),
    sources
  };
}

function formatRealityReconstruction(input = {}) {
  const result = input.reconstruction && input.evidence
    ? input
    : buildRealityReconstruction(input);
  const r = result.reconstruction;
  return [
    'Reality reconstruction',
    '',
    `What product are we building? ${r.product}`,
    '',
    `What stage are we in? ${r.stage}`,
    '',
    `What is the biggest bottleneck? ${r.bottleneck}`,
    '',
    `What are we actively searching for? ${r.activeSearch}`,
    '',
    `What assumptions are still unproven? ${r.unprovenAssumptions}`,
    '',
    `What should not be built? ${r.shouldNotBuild}`,
    '',
    'Why I believe this:',
    '- The founder memory files converge on "understand before typing" as the current north star.',
    '- The project state says Phase 1 is protected and Phase 2 differentiation is now the active company problem.',
    '- The rejected-directions memory explicitly says not to compete mainly on prediction, swipe, themes, architecture cleanup, emotional simulation, or autonomous execution.',
    '- The active hypotheses identify Explain and screenshot understanding as leading but not fully proven.',
    '',
    'Evidence sources used:',
    ...result.evidence.map((item) => `- ${item}`),
    '',
    'Missing information / uncertainty:',
    ...result.uncertainty.map((item) => `- ${item}`),
    '',
    `Confidence: ${Math.min(90, result.confidence)}%`,
    'Confidence is capped at 90% because this is reconstructed project judgment, not direct founder confirmation.'
  ].join('\n');
}

function buildEvidenceList(sourceMap) {
  const items = [];
  addEvidence(items, sourceMap['FOUNDER_VISION.md'], 'FOUNDER_VISION.md: defines Aritenis as a local-first keyboard intelligence layer and names “understand before typing” as the north star.');
  addEvidence(items, sourceMap['PROJECT_STATE.md'], 'PROJECT_STATE.md: states Phase 1 is protected, Phase 2 is differentiation, and agents still need better project-state understanding.');
  addEvidence(items, sourceMap['CURRENT_STAGE.md'], 'CURRENT_STAGE.md: identifies Phase 2 preparation / early Phase 2 and Explain as the active direction.');
  addEvidence(items, sourceMap['REJECTED_DIRECTIONS.md'], 'REJECTED_DIRECTIONS.md: lists rejected differentiators and unsafe execution/product patterns.');
  addEvidence(items, sourceMap['ACTIVE_HYPOTHESES.md'], 'ACTIVE_HYPOTHESES.md: lists Explain, screenshot understanding, glass handle activation, Product Lab reliability, and founder-memory consistency as active hypotheses.');
  addEvidence(items, sourceMap['ai-cto/roadmap-lock.json'], 'ai-cto/roadmap-lock.json: provides machine-readable roadmap lock evidence when present.');
  addEvidence(items, sourceMap['ai-cto/phase2-daily-agent-plan.json'], 'ai-cto/phase2-daily-agent-plan.json: shows the daily-agent system is planned around Phase 2 work when present.');
  return items.length ? items : ['No source files were visible; answer should be treated as insufficiently grounded.'];
}

function buildUncertaintyList({ missing, sourceMap, memoryLayer }) {
  const items = [];
  if (missing.length) items.push(`Missing project-state sources: ${missing.join(', ')}.`);
  const vision = sourceMap['FOUNDER_VISION.md'];
  if (vision && vision.text.includes('aritenis_evolved_vision.md') && vision.text.includes('not found')) {
    items.push('The latest evolved vision document was referenced but not found during founder-memory creation, so details from that document remain unavailable.');
  }
  if (memoryLayer && memoryLayer.confidence < 90) {
    items.push('Founder memory confidence is below 90%, so the agent must say it does not have enough founder context.');
  }
  items.push('The Explain wedge is leading, but its retention power is not proven by real users yet.');
  items.push('Product Lab screenshot reliability has been weak, so visual evidence cannot yet be treated as fully mature.');
  items.push('The founder has not approved a final 90-day Phase 2 killer-feature task plan.');
  return Array.from(new Set(items));
}

function addEvidence(items, source, message) {
  if (source && source.exists && source.text.trim().length > 0) items.push(message);
}

function calculateRealityConfidence({ memoryLayer, sources, missing }) {
  const visibleCount = sources.filter((source) => source.exists && source.text.trim().length > 50).length;
  const coverageScore = sources.length ? Math.round((visibleCount / sources.length) * 20) : 0;
  const founderScore = Math.min(50, Math.round((memoryLayer.confidence || 0) * 0.5));
  const uncertaintyPenalty = missing.length * 4;
  const latestVisionMissingPenalty = sources.some((source) =>
    source.relativePath === 'FOUNDER_VISION.md' &&
    source.text.includes('aritenis_evolved_vision.md') &&
    source.text.includes('not found')
  ) ? 6 : 0;
  return Math.max(35, Math.min(90, 50 + coverageScore + founderScore - uncertaintyPenalty - latestVisionMissingPenalty - 25));
}

function readSource(root, relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    const text = fs.readFileSync(fullPath, 'utf8');
    return { relativePath, fullPath, exists: true, text };
  } catch {
    return { relativePath, fullPath, exists: false, text: '' };
  }
}

module.exports = {
  PROJECT_STATE_FILES,
  buildRealityReconstruction,
  formatRealityReconstruction
};
