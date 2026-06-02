const MAX_TIMELINE = 40;
const MAX_PREVIOUS = 8;

function updateVisionMemory(existing = {}, input = {}) {
  const memory = normalizeVisionMemory(existing);
  const signal = extractVisionSignal(input.founderMessage || input.message || input.text || '');
  if (!signal) return memory;

  if (!memory.activeVision) {
    const activeVision = buildVision(signal, 72);
    return {
      ...memory,
      activeVision,
      currentFounderVision: activeVision.statement,
      visionConfidence: activeVision.confidence,
      timeline: addTimeline(memory.timeline, activeVision, 'ACTIVE_CREATED'),
      lastUpdatedAt: new Date().toISOString()
    };
  }

  if (memory.activeVision.id === signal.id) {
    const activeVision = strengthenVision(memory.activeVision, signal);
    return {
      ...memory,
      activeVision,
      currentFounderVision: activeVision.statement,
      visionConfidence: activeVision.confidence,
      candidateVisionChange: null,
      timeline: addTimeline(memory.timeline, activeVision, 'ACTIVE_REINFORCED'),
      lastUpdatedAt: new Date().toISOString()
    };
  }

  const candidate = memory.candidateVisionChange && memory.candidateVisionChange.id === signal.id
    ? strengthenVision(memory.candidateVisionChange, signal)
    : buildVision(signal, 66);

  if (candidate.confidence >= 76 || candidate.observations >= 2) {
    const previousVision = memory.activeVision;
    const activeVision = {
      ...candidate,
      confidence: Math.max(candidate.confidence, 78)
    };
    return {
      ...memory,
      activeVision,
      currentFounderVision: activeVision.statement,
      previousFounderVisions: [previousVision, ...memory.previousFounderVisions].slice(0, MAX_PREVIOUS),
      previousVision: previousVision.statement,
      visionShift: `${previousVision.statement} -> ${activeVision.statement}`,
      visionConfidence: activeVision.confidence,
      candidateVisionChange: null,
      timeline: addTimeline(addTimeline(memory.timeline, candidate, 'CANDIDATE_CONFIRMED'), activeVision, 'ACTIVE_CHANGED'),
      lastUpdatedAt: new Date().toISOString()
    };
  }

  return {
    ...memory,
    candidateVisionChange: candidate,
    timeline: addTimeline(memory.timeline, candidate, 'CANDIDATE_VISION_CHANGE'),
    lastUpdatedAt: new Date().toISOString()
  };
}

function retrieveActiveVision(memory = {}) {
  const normalized = normalizeVisionMemory(memory);
  const active = normalized.activeVision;
  if (!active) {
    return {
      currentFounderVision: null,
      previousVision: null,
      visionShift: null,
      visionConfidence: 0,
      timeline: []
    };
  }
  return {
    currentFounderVision: active.statement,
    activeVision: active,
    previousVision: normalized.previousVision ||
      (normalized.previousFounderVisions[0] && normalized.previousFounderVisions[0].statement) ||
      null,
    visionShift: normalized.visionShift || null,
    visionConfidence: active.confidence,
    candidateVisionChange: normalized.candidateVisionChange || null,
    timeline: normalized.timeline
  };
}

function formatVisionMemoryForResponse(retrieval = {}) {
  if (!retrieval || !retrieval.currentFounderVision) return '';
  return [
    `Current Founder Vision: ${retrieval.currentFounderVision}`,
    `Previous Vision: ${retrieval.previousVision || 'none recorded'}`,
    `Vision Shift: ${retrieval.visionShift || 'no confirmed shift yet'}`,
    `Vision Confidence: ${retrieval.visionConfidence || 0}%`
  ].join('\n');
}

function normalizeVisionMemory(value = {}) {
  return {
    version: '1.0',
    activeVision: value && value.activeVision ? value.activeVision : null,
    currentFounderVision: value && value.currentFounderVision ? value.currentFounderVision : null,
    previousFounderVisions: Array.isArray(value && value.previousFounderVisions) ? value.previousFounderVisions : [],
    previousVision: value && value.previousVision ? value.previousVision : null,
    visionShift: value && value.visionShift ? value.visionShift : null,
    visionConfidence: Number.isFinite(value && value.visionConfidence) ? value.visionConfidence : 0,
    candidateVisionChange: value && value.candidateVisionChange ? value.candidateVisionChange : null,
    timeline: Array.isArray(value && value.timeline) ? value.timeline : [],
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function extractVisionSignal(message = '') {
  const text = String(message || '').toLowerCase();
  if (/reduce burden humans carry alone|humans carry alone|humans choose direction|ai executes|trust over capability|freedom over dependency/.test(text)) {
    return {
      id: 'burden_direction_execution_trust_freedom',
      statement: [
        'Reduce burden humans carry alone.',
        'Humans choose direction; AI executes.',
        'Trust over capability.',
        'Freedom over dependency.'
      ].join(' '),
      evidence: clean(message),
      tags: ['burden reduction', 'human direction', 'ai execution', 'trust', 'freedom']
    };
  }
  if (/destroy loneliness|ai companion|loneliness/.test(text)) {
    return {
      id: 'destroy_loneliness_ai_companion',
      statement: 'Destroy loneliness through an AI companion.',
      evidence: clean(message),
      tags: ['loneliness', 'ai companion']
    };
  }
  if (/explain first|explain-first|understand before typing|screenshot understanding/.test(text)) {
    return {
      id: 'explain_first_understanding',
      statement: 'Explain-first: help users understand confusing content before typing.',
      evidence: clean(message),
      tags: ['explain', 'understand before typing']
    };
  }
  return null;
}

function buildVision(signal = {}, confidence = 66) {
  return {
    id: signal.id,
    statement: signal.statement,
    confidence,
    observations: 1,
    evidence: [signal.evidence].filter(Boolean).slice(0, 5),
    tags: signal.tags || [],
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
}

function strengthenVision(vision = {}, signal = {}) {
  const observations = Number(vision.observations || 1) + 1;
  return {
    ...vision,
    statement: signal.statement || vision.statement,
    observations,
    confidence: Math.min(90, Math.max(vision.confidence || 66, 62 + observations * 8)),
    evidence: [signal.evidence, ...(Array.isArray(vision.evidence) ? vision.evidence : [])].filter(Boolean).slice(0, 5),
    tags: [...new Set([...(vision.tags || []), ...(signal.tags || [])])],
    lastSeenAt: new Date().toISOString()
  };
}

function addTimeline(timeline = [], vision = {}, event = '') {
  return [{
    timestamp: new Date().toISOString(),
    event,
    visionId: vision.id,
    statement: vision.statement,
    confidence: vision.confidence
  }, ...(Array.isArray(timeline) ? timeline : [])].slice(0, MAX_TIMELINE);
}

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

module.exports = {
  updateVisionMemory,
  retrieveActiveVision,
  formatVisionMemoryForResponse,
  normalizeVisionMemory,
  extractVisionSignal
};
