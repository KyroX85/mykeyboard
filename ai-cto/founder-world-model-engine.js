const {
  retrieveActiveVision
} = require('./vision-memory-engine');

const MAX_TIMELINE = 40;
const MAX_PREVIOUS = 8;

const DEFAULT_WORLDVIEW = {
  id: 'burden_direction_execution_trust_freedom_worldview',
  currentWorldview: 'Humans should keep agency and direction; AI should reduce the burden of carrying, understanding, and executing alone.',
  currentMission: 'Build Aritenis into a trusted phone-native intelligence layer where humans choose direction and AI helps execute without creating dependency.',
  currentFears: [
    'building impressive systems that users do not care about',
    'turning helpful AI into dependency',
    'mistaking infrastructure progress for product progress',
    'losing trust while chasing capability'
  ],
  currentMotivations: [
    'freedom over dependency',
    'trust over raw capability',
    'user leverage over agent sophistication',
    'reduce the burden humans carry alone'
  ],
  currentDefinitionOfSuccess: 'Aritenis helps people understand and act with less burden while preserving their agency, trust, and control.',
  currentDefinitionOfFailure: 'Aritenis becomes impressive but optional, or Jarvis-like automation removes agency instead of increasing freedom.',
  sourceVisionId: 'burden_direction_execution_trust_freedom',
  confidence: 78,
  observations: 1,
  evidence: []
};

function updateFounderWorldModel(existing = {}, input = {}) {
  const memory = normalizeFounderWorldModel(existing);
  const vision = retrieveActiveVision(input.visionMemory || memory.visionMemory || {});
  const message = clean(input.founderMessage || input.message || input.text || '');
  const signal = extractWorldviewSignal(message, vision);

  if (!signal && !vision.currentFounderVision) return memory;

  const currentSignal = signal || signalFromVision(vision);
  if (!currentSignal) return memory;

  const current = memory.currentWorldModel;
  if (!current) {
    const created = buildWorldModel(currentSignal, 74);
    return {
      ...memory,
      currentWorldModel: created,
      activeWorldview: created.currentWorldview,
      activeMission: created.currentMission,
      worldviewConfidence: created.confidence,
      visionMemory: vision,
      timeline: addTimeline(memory.timeline, created, 'ACTIVE_CREATED'),
      lastUpdatedAt: now()
    };
  }

  if (current.id === currentSignal.id) {
    const strengthened = strengthenWorldModel(current, currentSignal);
    return {
      ...memory,
      currentWorldModel: strengthened,
      activeWorldview: strengthened.currentWorldview,
      activeMission: strengthened.currentMission,
      worldviewConfidence: strengthened.confidence,
      candidateWorldModelChange: null,
      visionMemory: vision,
      timeline: addTimeline(memory.timeline, strengthened, 'ACTIVE_REINFORCED'),
      lastUpdatedAt: now()
    };
  }

  const candidate = memory.candidateWorldModelChange && memory.candidateWorldModelChange.id === currentSignal.id
    ? strengthenWorldModel(memory.candidateWorldModelChange, currentSignal)
    : buildWorldModel(currentSignal, 64);

  if (candidate.confidence >= 76 || candidate.observations >= 2) {
    const previous = current;
    const promoted = {
      ...candidate,
      confidence: Math.max(candidate.confidence, 78)
    };
    return {
      ...memory,
      currentWorldModel: promoted,
      activeWorldview: promoted.currentWorldview,
      activeMission: promoted.currentMission,
      previousWorldModels: [previous, ...memory.previousWorldModels].slice(0, MAX_PREVIOUS),
      previousWorldview: previous.currentWorldview,
      worldviewShift: `${previous.currentWorldview} -> ${promoted.currentWorldview}`,
      worldviewConfidence: promoted.confidence,
      candidateWorldModelChange: null,
      visionMemory: vision,
      timeline: addTimeline(addTimeline(memory.timeline, candidate, 'CANDIDATE_CONFIRMED'), promoted, 'ACTIVE_CHANGED'),
      lastUpdatedAt: now()
    };
  }

  return {
    ...memory,
    candidateWorldModelChange: candidate,
    visionMemory: vision,
    timeline: addTimeline(memory.timeline, candidate, 'CANDIDATE_WORLD_MODEL_CHANGE'),
    lastUpdatedAt: now()
  };
}

function retrieveFounderWorldModel(memory = {}, options = {}) {
  const normalized = normalizeFounderWorldModel(memory);
  const vision = retrieveActiveVision(options.visionMemory || normalized.visionMemory || {});
  const current = normalized.currentWorldModel || buildWorldModel(signalFromVision(vision) || DEFAULT_WORLDVIEW, DEFAULT_WORLDVIEW.confidence);

  return {
    currentWorldModel: current,
    currentWorldview: current.currentWorldview,
    currentMission: current.currentMission,
    currentFears: current.currentFears || [],
    currentMotivations: current.currentMotivations || [],
    currentDefinitionOfSuccess: current.currentDefinitionOfSuccess,
    currentDefinitionOfFailure: current.currentDefinitionOfFailure,
    previousWorldview: normalized.previousWorldview || (normalized.previousWorldModels[0] && normalized.previousWorldModels[0].currentWorldview) || null,
    worldviewShift: normalized.worldviewShift || null,
    worldviewConfidence: current.confidence || normalized.worldviewConfidence || 0,
    candidateWorldModelChange: normalized.candidateWorldModelChange,
    activeVision: vision,
    timeline: normalized.timeline
  };
}

function formatFounderWorldModelForResponse(world = {}) {
  const current = retrieveFounderWorldModel(world);
  return [
    `Current Founder Worldview: ${current.currentWorldview || 'unknown'}`,
    `Current Founder Mission: ${current.currentMission || 'unknown'}`,
    `Current Definition of Success: ${current.currentDefinitionOfSuccess || 'unknown'}`,
    `Current Definition of Failure: ${current.currentDefinitionOfFailure || 'unknown'}`,
    `Worldview Confidence: ${current.worldviewConfidence || 0}%`
  ].join('\n');
}

function normalizeFounderWorldModel(value = {}) {
  return {
    version: '1.0',
    currentWorldModel: value && value.currentWorldModel ? value.currentWorldModel : null,
    activeWorldview: value && value.activeWorldview ? value.activeWorldview : null,
    activeMission: value && value.activeMission ? value.activeMission : null,
    previousWorldModels: Array.isArray(value && value.previousWorldModels) ? value.previousWorldModels : [],
    previousWorldview: value && value.previousWorldview ? value.previousWorldview : null,
    worldviewShift: value && value.worldviewShift ? value.worldviewShift : null,
    worldviewConfidence: Number.isFinite(value && value.worldviewConfidence) ? value.worldviewConfidence : 0,
    candidateWorldModelChange: value && value.candidateWorldModelChange ? value.candidateWorldModelChange : null,
    visionMemory: value && value.visionMemory ? value.visionMemory : null,
    timeline: Array.isArray(value && value.timeline) ? value.timeline : [],
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function extractWorldviewSignal(message = '', vision = {}) {
  const text = String(message || '').toLowerCase();
  if (/reduce burden humans carry alone|humans choose direction|ai executes|trust over capability|freedom over dependency|jarvis.*(dependency|freedom)|humans.*free/.test(text)) {
    return {
      ...DEFAULT_WORLDVIEW,
      evidence: [clean(message), vision.currentFounderVision].filter(Boolean)
    };
  }

  if (/destroy loneliness|ai companion|loneliness/.test(text)) {
    return {
      id: 'destroy_loneliness_companion_worldview',
      currentWorldview: 'Humans need an AI companion that reduces loneliness and emotional isolation.',
      currentMission: 'Build Aritenis toward an AI companion that helps people feel less alone.',
      currentFears: [
        'people remain alone with thoughts they cannot share',
        'the product becomes useful but emotionally irrelevant'
      ],
      currentMotivations: [
        'destroy loneliness',
        'build a companion people can rely on'
      ],
      currentDefinitionOfSuccess: 'Aritenis makes people feel less alone and more supported.',
      currentDefinitionOfFailure: 'Aritenis becomes technically useful but does not reduce loneliness or isolation.',
      sourceVisionId: 'destroy_loneliness_ai_companion',
      confidence: 66,
      observations: 1,
      evidence: [clean(message)].filter(Boolean)
    };
  }

  if (/impressive instead of useful|users? (do not|don't) care|fake progress|architecture theatre|infrastructure progress/.test(text)) {
    return {
      ...DEFAULT_WORLDVIEW,
      currentFears: [
        'building impressive systems that users do not care about',
        'fake progress replacing user-facing proof',
        'agent sophistication distracting from daily habit'
      ],
      evidence: [clean(message), vision.currentFounderVision].filter(Boolean)
    };
  }

  return signalFromVision(vision);
}

function signalFromVision(vision = {}) {
  const statement = String(vision.currentFounderVision || '').toLowerCase();
  if (/reduce burden humans carry alone|humans choose direction|ai executes|trust over capability|freedom over dependency/.test(statement)) {
    return {
      ...DEFAULT_WORLDVIEW,
      evidence: [vision.currentFounderVision].filter(Boolean)
    };
  }
  if (/destroy loneliness|ai companion|loneliness/.test(statement)) {
    return extractWorldviewSignal(vision.currentFounderVision || 'destroy loneliness through an AI companion', {});
  }
  return null;
}

function buildWorldModel(signal = {}, confidence = 66) {
  return {
    id: signal.id,
    currentWorldview: signal.currentWorldview,
    currentMission: signal.currentMission,
    currentFears: boundedList(signal.currentFears),
    currentMotivations: boundedList(signal.currentMotivations),
    currentDefinitionOfSuccess: signal.currentDefinitionOfSuccess,
    currentDefinitionOfFailure: signal.currentDefinitionOfFailure,
    sourceVisionId: signal.sourceVisionId || null,
    confidence,
    observations: 1,
    evidence: boundedList(signal.evidence, 6),
    firstSeenAt: now(),
    lastSeenAt: now()
  };
}

function strengthenWorldModel(model = {}, signal = {}) {
  const observations = Number(model.observations || 1) + 1;
  return {
    ...model,
    currentWorldview: signal.currentWorldview || model.currentWorldview,
    currentMission: signal.currentMission || model.currentMission,
    currentFears: boundedList([...(signal.currentFears || []), ...(model.currentFears || [])], 8),
    currentMotivations: boundedList([...(signal.currentMotivations || []), ...(model.currentMotivations || [])], 8),
    currentDefinitionOfSuccess: signal.currentDefinitionOfSuccess || model.currentDefinitionOfSuccess,
    currentDefinitionOfFailure: signal.currentDefinitionOfFailure || model.currentDefinitionOfFailure,
    observations,
    confidence: Math.min(90, Math.max(model.confidence || 66, 62 + observations * 8)),
    evidence: boundedList([...(signal.evidence || []), ...(model.evidence || [])], 6),
    lastSeenAt: now()
  };
}

function addTimeline(timeline = [], model = {}, event = '') {
  return [{
    timestamp: now(),
    event,
    worldModelId: model.id,
    worldview: model.currentWorldview,
    confidence: model.confidence
  }, ...(Array.isArray(timeline) ? timeline : [])].slice(0, MAX_TIMELINE);
}

function boundedList(items = [], limit = 8) {
  return [...new Set((Array.isArray(items) ? items : [items])
    .filter(Boolean)
    .map((item) => clean(item))
    .filter(Boolean))].slice(0, limit);
}

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 280);
}

function now() {
  return new Date().toISOString();
}

module.exports = {
  updateFounderWorldModel,
  retrieveFounderWorldModel,
  formatFounderWorldModelForResponse,
  normalizeFounderWorldModel,
  extractWorldviewSignal
};
