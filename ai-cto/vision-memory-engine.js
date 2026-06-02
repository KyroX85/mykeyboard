const MAX_TIMELINE = 40;
const MAX_PREVIOUS = 8;
const MAX_VERSIONS = 12;

function updateVisionMemory(existing = {}, input = {}) {
  const memory = normalizeVisionMemory(existing);
  const signal = extractVisionSignal(input.founderMessage || input.message || input.text || '');
  if (!signal) return memory;

  if (!memory.activeVision) {
    const activeVision = withVersion(buildVision(signal, 72), 1, {
      whyItExisted: signal.whyItExisted,
      whyItChanged: null,
      whatReplacedIt: null,
      status: 'ACTIVE'
    });
    return {
      ...memory,
      activeVision,
      currentFounderVision: activeVision.statement,
      currentVisionVersion: activeVision.versionLabel,
      visionConfidence: activeVision.confidence,
      visionVersions: [activeVision],
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
      currentVisionVersion: activeVision.versionLabel,
      visionConfidence: activeVision.confidence,
      candidateVisionChange: null,
      visionVersions: upsertActiveVersion(memory.visionVersions, activeVision),
      timeline: addTimeline(memory.timeline, activeVision, 'ACTIVE_REINFORCED'),
      lastUpdatedAt: new Date().toISOString()
    };
  }

  const candidate = memory.candidateVisionChange && memory.candidateVisionChange.id === signal.id
    ? strengthenVision(memory.candidateVisionChange, signal)
    : buildVision(signal, 66);

  if (candidate.confidence >= 76 || candidate.observations >= 2) {
    const nextVersionNumber = nextVisionVersionNumber(memory);
    const activeVision = {
      ...candidate,
      confidence: Math.max(candidate.confidence, 78),
      versionNumber: nextVersionNumber,
      versionLabel: `Vision v${nextVersionNumber}`,
      status: 'ACTIVE',
      whyItExisted: candidate.whyItExisted || reasonForVision(candidate),
      whyItChanged: null,
      whatReplacedIt: null
    };
    const previousVision = {
      ...memory.activeVision,
      status: 'REPLACED',
      whyItChanged: reasonForVisionChange(memory.activeVision, activeVision),
      whatReplacedIt: `${activeVision.versionLabel}: ${activeVision.statement}`
    };
    const visionVersions = [
      activeVision,
      previousVision,
      ...memory.visionVersions.filter((vision) => vision.id !== previousVision.id && vision.id !== activeVision.id)
    ].slice(0, MAX_VERSIONS);
    return {
      ...memory,
      activeVision,
      currentFounderVision: activeVision.statement,
      currentVisionVersion: activeVision.versionLabel,
      previousFounderVisions: [previousVision, ...memory.previousFounderVisions].slice(0, MAX_PREVIOUS),
      previousVision: previousVision.statement,
      visionShift: `${previousVision.statement} -> ${activeVision.statement}`,
      visionConfidence: activeVision.confidence,
      candidateVisionChange: null,
      visionVersions,
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
    currentVisionVersion: active.versionLabel || null,
    activeVision: active,
    previousVision: normalized.previousVision ||
      (normalized.previousFounderVisions[0] && normalized.previousFounderVisions[0].statement) ||
      null,
    visionShift: normalized.visionShift || null,
    visionConfidence: active.confidence,
    visionVersions: normalized.visionVersions,
    candidateVisionChange: normalized.candidateVisionChange || null,
    timeline: normalized.timeline
  };
}

function formatVisionMemoryForResponse(retrieval = {}) {
  if (!retrieval || !retrieval.currentFounderVision) return '';
  return [
    `Current Founder Vision: ${retrieval.currentVisionVersion ? `${retrieval.currentVisionVersion}: ` : ''}${retrieval.currentFounderVision}`,
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
    currentVisionVersion: value && value.currentVisionVersion ? value.currentVisionVersion : null,
    previousFounderVisions: Array.isArray(value && value.previousFounderVisions) ? value.previousFounderVisions : [],
    previousVision: value && value.previousVision ? value.previousVision : null,
    visionShift: value && value.visionShift ? value.visionShift : null,
    visionConfidence: Number.isFinite(value && value.visionConfidence) ? value.visionConfidence : 0,
    visionVersions: normalizeVisionVersions(value),
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
      tags: ['burden reduction', 'human direction', 'ai execution', 'trust', 'freedom'],
      whyItExisted: 'The founder evolved from emotional companionship toward human agency: reduce burden while keeping humans in charge.',
      replacesBecause: 'It replaced older companion framing because freedom, agency, trust, and useful execution became more important than emotional companionship alone.'
    };
  }
  if (/destroy loneliness|ai companion|loneliness/.test(text)) {
    return {
      id: 'destroy_loneliness_ai_companion',
      statement: 'Destroy loneliness through an AI companion.',
      evidence: clean(message),
      tags: ['loneliness', 'ai companion'],
      whyItExisted: 'The early dream centered on the human pain of loneliness and the desire for an AI companion people could rely on.',
      replacesBecause: null
    };
  }
  if (/explain first|explain-first|understand before typing|screenshot understanding/.test(text)) {
    return {
      id: 'explain_first_understanding',
      statement: 'Explain-first: help users understand confusing content before typing.',
      evidence: clean(message),
      tags: ['explain', 'understand before typing'],
      whyItExisted: 'This vision existed as the first practical wedge that could turn the trusted keyboard into user-visible leverage.',
      replacesBecause: 'It narrowed the dream into a concrete product wedge: understanding before typing.'
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
    whyItExisted: signal.whyItExisted || reasonForVision(signal),
    whyItChanged: null,
    whatReplacedIt: null,
    status: 'CANDIDATE',
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
    whyItExisted: vision.whyItExisted || signal.whyItExisted || reasonForVision(signal),
    lastSeenAt: new Date().toISOString()
  };
}

function normalizeVisionVersions(memory = {}) {
  if (Array.isArray(memory && memory.visionVersions) && memory.visionVersions.length) {
    return memory.visionVersions
      .map((vision, index) => withVersion(vision, vision.versionNumber || index + 1, {
        status: vision.status || (index === 0 ? 'ACTIVE' : 'REPLACED')
      }))
      .slice(0, MAX_VERSIONS);
  }
  const active = memory && memory.activeVision
    ? [withVersion(memory.activeVision, 1, { status: 'ACTIVE' })]
    : [];
  const previous = Array.isArray(memory && memory.previousFounderVisions)
    ? memory.previousFounderVisions.map((vision, index) => withVersion(vision, index + 2, { status: 'REPLACED' }))
    : [];
  return [...active, ...previous].slice(0, MAX_VERSIONS);
}

function withVersion(vision = {}, versionNumber = 1, overrides = {}) {
  const number = Number.isFinite(Number(versionNumber)) ? Number(versionNumber) : 1;
  return {
    ...vision,
    versionNumber: number,
    versionLabel: vision.versionLabel || `Vision v${number}`,
    whyItExisted: overrides.whyItExisted || vision.whyItExisted || reasonForVision(vision),
    whyItChanged: overrides.whyItChanged === undefined ? vision.whyItChanged || null : overrides.whyItChanged,
    whatReplacedIt: overrides.whatReplacedIt === undefined ? vision.whatReplacedIt || null : overrides.whatReplacedIt,
    status: overrides.status || vision.status || 'ACTIVE'
  };
}

function nextVisionVersionNumber(memory = {}) {
  const versions = Array.isArray(memory.visionVersions) ? memory.visionVersions : [];
  const max = versions.reduce((highest, vision) => Math.max(highest, Number(vision.versionNumber || 0)), 0);
  return Math.max(max + 1, 2);
}

function upsertActiveVersion(versions = [], activeVision = {}) {
  const active = withVersion(activeVision, activeVision.versionNumber || 1, { status: 'ACTIVE' });
  return [active, ...(Array.isArray(versions) ? versions : []).filter((vision) => vision.id !== active.id)].slice(0, MAX_VERSIONS);
}

function reasonForVision(vision = {}) {
  const text = `${vision.id || ''} ${vision.statement || ''}`.toLowerCase();
  if (/burden|direction|freedom|trust/.test(text)) {
    return 'This vision exists because the founder now values reducing human burden while preserving agency, trust, and freedom.';
  }
  if (/loneliness|companion/.test(text)) {
    return 'This vision existed because the founder originally framed the dream around loneliness and AI companionship.';
  }
  if (/explain|understand/.test(text)) {
    return 'This vision exists because Explain is the practical wedge for making the dream useful inside daily phone workflows.';
  }
  return 'This vision existed as a founder direction signal that needed to be preserved until replaced by stronger evidence.';
}

function reasonForVisionChange(previous = {}, active = {}) {
  if (active.replacesBecause) return active.replacesBecause;
  const prev = `${previous.id || ''} ${previous.statement || ''}`.toLowerCase();
  const next = `${active.id || ''} ${active.statement || ''}`.toLowerCase();
  if (/loneliness|companion/.test(prev) && /burden|direction|freedom|trust/.test(next)) {
    return 'The founder shifted from emotional companion framing toward a broader freedom model: humans choose direction, AI reduces burden, and trust matters more than capability.';
  }
  if (/burden|direction|freedom|trust/.test(prev) && /explain|understand/.test(next)) {
    return 'The founder narrowed the broad dream into the Explain wedge so the product could prove daily usefulness.';
  }
  return 'A newer vision gained repeated evidence and replaced this one as the active founder direction.';
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
