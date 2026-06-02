const MAX_EVENTS = 80;
const MAX_BLINDSPOTS = 8;

function detectFounderBlindspots(memory = {}) {
  const events = collectBlindspotEvents(memory);
  const grouped = groupEvents(events);
  const recurringBlindspots = Object.values(grouped)
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.priority - a.priority || b.count - a.count || b.confidence - a.confidence)
    .slice(0, MAX_BLINDSPOTS);

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    sourceEventCount: events.length,
    recurringFears: recurringBlindspots.filter((item) => item.kind === 'fear'),
    recurringAssumptions: recurringBlindspots.filter((item) => item.kind === 'assumption'),
    recurringFrustrations: recurringBlindspots.filter((item) => item.kind === 'frustration'),
    recurringDistractions: recurringBlindspots.filter((item) => item.kind === 'distraction'),
    recurringBlindspots,
    topBlindspot: recurringBlindspots[0] || null,
    summary: recurringBlindspots[0]
      ? formatBlindspotSummary(recurringBlindspots[0])
      : 'No recurring founder blindspot has enough repeated evidence yet.',
    confidence: confidenceFor(events.length, recurringBlindspots)
  };
}

function updateFounderBlindspotMemory(existing = {}, memory = {}) {
  const previous = normalizeBlindspotMemory(existing);
  const detection = detectFounderBlindspots(memory);
  if (!detection.topBlindspot) {
    return {
      ...previous,
      lastUpdatedAt: new Date().toISOString(),
      lastDetection: detection
    };
  }

  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastDetection: detection,
    activeBlindspots: detection.recurringBlindspots,
    history: [detection, ...previous.history].slice(0, 20)
  };
}

function normalizeBlindspotMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastDetection: source.lastDetection || null,
    activeBlindspots: Array.isArray(source.activeBlindspots) ? source.activeBlindspots.slice(0, MAX_BLINDSPOTS) : [],
    history: Array.isArray(source.history) ? source.history.slice(0, 20) : []
  };
}

function formatBlindspotSummary(blindspot = {}) {
  if (!blindspot || !blindspot.label) return 'No recurring founder blindspot has enough repeated evidence yet.';
  return `You have returned to ${blindspot.label} ${blindspot.count} times recently. ${blindspot.implication}`;
}

function collectBlindspotEvents(memory = {}) {
  const rawSources = [
    ...asArray(memory.founderDoubts).map((item) => sourceText(item, 'founderDoubts')),
    ...asArray(memory.founderConcerns).map((item) => sourceText(item, 'founderConcerns')),
    ...asArray(memory.founderFeedback).map((item) => sourceText(item, 'founderFeedback')),
    ...asArray(memory.recentMessages).map((item) => sourceText(item, 'recentMessages')),
    ...asArray(memory.founderQuestionClusters && memory.founderQuestionClusters.recentQuestions).map((item) => sourceText(item, 'founderQuestionClusters')),
    ...asArray(memory.compressedFounderInsights).map((item) => sourceText(item, 'compressedFounderInsights'))
  ].filter((item) => item.text);

  const events = [];
  for (const source of rawSources) {
    for (const candidate of BLINDSPOT_CANDIDATES) {
      if (!candidate.regex.test(source.text)) continue;
      events.push({
        id: candidate.id,
        kind: candidate.kind,
        label: candidate.label,
        implication: candidate.implication,
        source: source.source,
        evidence: source.preview,
        timestamp: source.timestamp || null,
        confidenceWeight: candidate.weight,
        priority: candidate.priority
      });
    }
  }
  return events.slice(0, MAX_EVENTS);
}

function groupEvents(events = []) {
  const grouped = {};
  for (const event of events) {
    if (!grouped[event.id]) {
      grouped[event.id] = {
        id: event.id,
        kind: event.kind,
        label: event.label,
        implication: event.implication,
        count: 0,
        evidence: [],
        sources: {},
        confidence: 0,
        priority: 0
      };
    }
    grouped[event.id].count += 1;
    grouped[event.id].confidence += event.confidenceWeight || 1;
    grouped[event.id].priority += event.priority || 1;
    grouped[event.id].sources[event.source] = (grouped[event.id].sources[event.source] || 0) + 1;
    if (grouped[event.id].evidence.length < 4) grouped[event.id].evidence.push(event.evidence);
  }

  for (const item of Object.values(grouped)) {
    item.confidence = Math.min(90, 48 + item.count * 7 + Object.keys(item.sources).length * 4);
    item.sourceBreakdown = item.sources;
    delete item.sources;
  }
  return grouped;
}

function sourceText(item = {}, source = 'unknown') {
  const text = [
    item.founderMessage,
    item.sourceMessage,
    item.rawQuestionPreview,
    item.questionPattern,
    item.summary,
    item.feedback,
    item.answerPattern,
    item.objective,
    item.assumption,
    item.concern,
    item.actualQuestion,
    item.desiredOutcome,
    item.insight,
    item.implication
  ].filter(Boolean).join(' ');
  return {
    source,
    text: normalize(text),
    preview: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220),
    timestamp: item.timestamp || null
  };
}

function confidenceFor(eventCount, blindspots = []) {
  if (!blindspots.length) return Math.min(70, 35 + eventCount * 2);
  return Math.min(90, 55 + Math.max(...blindspots.map((item) => item.count)) * 5 + blindspots.length * 3);
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

const BLINDSPOT_CANDIDATES = [
  {
    id: 'adoption_fear_loop',
    kind: 'fear',
    label: 'adoption fear',
    regex: /\b(users?\s+(do\s+not|don\s+t|dont|will\s+not|won\s+t|actually)?\s*(care|use|return|want|need)|adoption|daily habit|habit forming|user pull)\b/i,
    implication: 'This points to the real bottleneck: proving repeated user pull, not adding more agent machinery.',
    weight: 3,
    priority: 5
  },
  {
    id: 'impressive_not_useful_loop',
    kind: 'fear',
    label: 'the impressive-versus-useful fear',
    regex: /\b(impressive|advanced|complex|architecture|infrastructure|agent layers?|ai system|cool)\b.*\b(useful|value|user|real|care)\b|\b(useful|value|user|real|care)\b.*\b(impressive|advanced|complex|architecture|infrastructure|agent layers?|ai system|cool)\b/i,
    implication: 'You are repeatedly checking whether we are building leverage or just impressive scaffolding.',
    weight: 3,
    priority: 4
  },
  {
    id: 'wrong_focus_loop',
    kind: 'distraction',
    label: 'wrong-focus anxiety',
    regex: /\b(wrong thing|wrong focus|wrong direction|misaligned|focusing on the wrong|too much infrastructure|not closer to the dream)\b/i,
    implication: 'This suggests a recurring risk of confusing motion with progress toward the killer user moment.',
    weight: 3,
    priority: 4
  },
  {
    id: 'agent_intelligence_distrust_loop',
    kind: 'frustration',
    label: 'agent intelligence distrust',
    regex: /\b(agents?\s+(do\s+not|don\s+t|dont|still|really)?\s*(understand|dumb|basic|rule based|template|keyword)|generic|irrelevant|wrong route|too much cto mode|health|momentum|team ready)\b/i,
    implication: 'Bad routing is being interpreted as proof that the company cannot be left to agents yet.',
    weight: 2,
    priority: 2
  },
  {
    id: 'dream_validity_loop',
    kind: 'assumption',
    label: 'dream-validity doubt',
    regex: /\b(dream.*wrong|wrong dream|what if my dream|chasing|jarvis|personal intelligence layer|final goal)\b/i,
    implication: 'You are not only asking what to build; you are testing whether the ambition itself is valid.',
    weight: 2,
    priority: 3
  },
  {
    id: 'privacy_trust_loop',
    kind: 'assumption',
    label: 'privacy trust anxiety',
    regex: /\b(privacy|raw text|screenshot.*forever|silent|cloud telemetry|leak|store screenshots|typed text)\b/i,
    implication: 'You keep treating privacy as product trust, not compliance decoration.',
    weight: 2,
    priority: 3
  }
];

module.exports = {
  detectFounderBlindspots,
  updateFounderBlindspotMemory,
  normalizeBlindspotMemory,
  formatBlindspotSummary,
  collectBlindspotEvents
};
