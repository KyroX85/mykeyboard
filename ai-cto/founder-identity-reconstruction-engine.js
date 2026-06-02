const {
  retrieveActiveVision
} = require('./vision-memory-engine');
const {
  retrieveFounderWorldModel
} = require('./founder-world-model-engine');
const {
  normalizeBeliefEvolution
} = require('./belief-evolution-engine');
const {
  normalizePrincipleMemory
} = require('./principle-extraction-engine');
const {
  normalizeStrategicMemory,
  retrieveRelevantStrategicMemory
} = require('./strategic-memory-layer');

const IDENTITY_INTENTS = new Set([
  'RECONSTRUCT_FOUNDER_IDENTITY_TRAJECTORY',
  'RECONSTRUCT_FOUNDER_MOTIVATION',
  'RECONSTRUCT_FOUNDER_BEHAVIOR_OPTIMIZATION',
  'RECONSTRUCT_RECENT_BELIEF_SHIFT',
  'RECONSTRUCT_FOUNDER_EVOLUTION'
]);

function shouldReconstructFounderIdentity(message = '', intent = '') {
  const text = String(message || '').toLowerCase();
  if (IDENTITY_INTENTS.has(String(intent || ''))) return true;
  return /\b(who\s+am\s+i\s+becoming|what\s+motivates\s+me|what\s+am\s+i\s+optimizing\s+for|belief\s+changed|changed\s+my\s+mind|same\s+founder|founder\s+evolv)/i.test(text);
}

function reconstructFounderIdentity(input = {}) {
  const memory = input.memory || {};
  const question = input.question || input.message || '';
  const vision = retrieveActiveVision(memory.visionMemory || input.visionMemory || {});
  const world = retrieveFounderWorldModel(memory.founderWorldModel || input.founderWorldModel || {}, {
    visionMemory: memory.visionMemory || input.visionMemory || {}
  });
  const beliefEvolution = normalizeBeliefEvolution(memory.beliefEvolution || input.beliefEvolution || {});
  const principles = normalizePrincipleMemory(memory.founderPrinciples || input.founderPrinciples || {});
  const strategicMemory = normalizeStrategicMemory(memory.strategicMemory || input.strategicMemory || {});
  const strategicRetrieval = retrieveRelevantStrategicMemory(question, strategicMemory, { limit: 4 });
  const contradictions = normalizeContradictions(memory.founderContradictions || memory.contradictionEngine || input.contradictions);

  const latestBelief = beliefEvolution.lastEvolution || first(beliefEvolution.evolvedBeliefs);
  const activePrinciple = first(principles.principles);
  const activeVision = vision.activeVision || null;
  const previousVision = first(vision.visionVersions && vision.visionVersions.filter((item) => item.status === 'REPLACED')) ||
    first(vision.activeVision ? [] : []) ||
    null;

  const oldIdentity = inferOldIdentity({ latestBelief, previousVision, vision });
  const emergingIdentity = inferEmergingIdentity({ latestBelief, activePrinciple, strategicRetrieval, contradictions });
  const currentIdentity = inferCurrentIdentity({ world, activeVision, latestBelief, activePrinciple });

  return {
    version: '1.0',
    oldIdentity,
    emergingIdentity,
    currentIdentity,
    evidence: buildEvidence({
      latestBelief,
      activePrinciple,
      activeVision,
      previousVision,
      strategicRetrieval,
      contradictions,
      world
    }),
    confidence: estimateConfidence({
      latestBelief,
      activePrinciple,
      activeVision,
      strategicRetrieval,
      contradictions,
      world
    })
  };
}

function formatFounderIdentityTrajectory(identity = {}) {
  if (!identity || !identity.currentIdentity) return '';
  const lines = [
    'Founder Identity Trajectory:',
    `- Old identity: ${identity.oldIdentity || 'not enough evidence recorded'}`,
    `- Emerging identity: ${identity.emergingIdentity || 'not enough evidence recorded'}`,
    `- Current identity: ${identity.currentIdentity || 'not enough evidence recorded'}`,
    `- Confidence: ${identity.confidence || 0}%`
  ];
  if (Array.isArray(identity.evidence) && identity.evidence.length) {
    lines.push(`- Evidence used: ${identity.evidence.slice(0, 4).join(' | ')}`);
  }
  return lines.join('\n');
}

function inferOldIdentity({ latestBelief, previousVision, vision }) {
  if (latestBelief && latestBelief.previousBelief) {
    return `a founder who believed ${lowerFirst(latestBelief.previousBelief)}`;
  }
  const previous = previousVision || (vision && vision.previousVision ? { statement: vision.previousVision } : null);
  if (previous && previous.statement) {
    return `a founder centered on ${lowerFirst(previous.statement)}`;
  }
  return 'a builder proving the keyboard and agent foundation could survive';
}

function inferEmergingIdentity({ latestBelief, activePrinciple, strategicRetrieval, contradictions }) {
  if (latestBelief && latestBelief.currentBelief) {
    return `a founder shifting toward ${lowerFirst(latestBelief.currentBelief)}`;
  }
  if (activePrinciple && activePrinciple.principle) {
    return `a founder learning to enforce this principle: ${activePrinciple.principle}`;
  }
  const strategic = first(strategicRetrieval.items);
  if (strategic && strategic.summary) {
    return `a founder turning repeated lessons into judgment: ${strategic.summary}`;
  }
  const contradiction = first(contradictions);
  if (contradiction) {
    return `a founder noticing contradictions instead of hiding from them: ${contradiction}`;
  }
  return 'a founder moving from system-building toward product truth';
}

function inferCurrentIdentity({ world, activeVision, latestBelief, activePrinciple }) {
  if (world && world.currentMission) {
    return `a founder trying to ${lowerFirst(world.currentMission)}`;
  }
  if (activeVision && activeVision.statement) {
    return `a founder operating from the active vision: ${activeVision.versionLabel || 'current vision'} - ${activeVision.statement}`;
  }
  if (latestBelief && latestBelief.currentBelief) {
    return `a founder who now judges progress by ${lowerFirst(latestBelief.currentBelief)}`;
  }
  if (activePrinciple && activePrinciple.principle) {
    return `a founder who now values ${lowerFirst(activePrinciple.principle)}`;
  }
  return 'a founder optimizing for useful leverage, truth, trust, and agency';
}

function buildEvidence({
  latestBelief,
  activePrinciple,
  activeVision,
  previousVision,
  strategicRetrieval,
  contradictions,
  world
}) {
  return [
    latestBelief && latestBelief.currentBelief ? `belief evolution: ${latestBelief.previousBelief || 'unknown'} -> ${latestBelief.currentBelief}` : null,
    activePrinciple && activePrinciple.principle ? `principle: ${activePrinciple.principle}` : null,
    activeVision && activeVision.statement ? `active vision: ${activeVision.versionLabel || 'current'} ${activeVision.statement}` : null,
    previousVision && previousVision.whyItChanged ? `vision shift: ${previousVision.whyItChanged}` : null,
    world && world.currentDefinitionOfSuccess ? `success definition: ${world.currentDefinitionOfSuccess}` : null,
    first(strategicRetrieval.items) && first(strategicRetrieval.items).summary ? `strategic memory: ${first(strategicRetrieval.items).summary}` : null,
    first(contradictions) ? `contradiction: ${first(contradictions)}` : null
  ].filter(Boolean).map(clean).slice(0, 6);
}

function estimateConfidence({ latestBelief, activePrinciple, activeVision, strategicRetrieval, contradictions, world }) {
  let confidence = 42;
  if (latestBelief) confidence += 12;
  if (activePrinciple) confidence += 10;
  if (activeVision) confidence += 12;
  if (world && world.currentMission) confidence += 12;
  if (strategicRetrieval && strategicRetrieval.items && strategicRetrieval.items.length) confidence += 8;
  if (contradictions && contradictions.length) confidence += 6;
  return Math.min(88, confidence);
}

function normalizeContradictions(value = {}) {
  const items = [];
  for (const key of ['contradictions', 'recentContradictions', 'detectedContradictions']) {
    const list = Array.isArray(value && value[key]) ? value[key] : [];
    for (const item of list) {
      items.push(clean(item.contradiction || item.summary || item.issue || item));
    }
  }
  if (value && value.lastContradiction) {
    items.push(clean(value.lastContradiction.contradiction || value.lastContradiction.summary || value.lastContradiction));
  }
  return [...new Set(items.filter(Boolean))].slice(0, 5);
}

function lowerFirst(value = '') {
  const text = clean(value);
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function first(items = []) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

module.exports = {
  shouldReconstructFounderIdentity,
  reconstructFounderIdentity,
  formatFounderIdentityTrajectory
};
