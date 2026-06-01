const PATTERN_INTERVAL = 50;
const MAX_PATTERN_REPORTS = 10;
const MAX_ITEMS_PER_SECTION = 5;

function shouldGeneratePatternReport(memory = {}) {
  const count = countConversationSignals(memory);
  if (count < PATTERN_INTERVAL) return false;
  const currentBucket = Math.floor(count / PATTERN_INTERVAL);
  const previousBucket = memory.founderPatternDiscovery
    ? Number(memory.founderPatternDiscovery.lastConversationBucket || 0)
    : 0;
  return currentBucket > previousBucket;
}

function updateFounderPatternDiscovery(existing = {}, memory = {}) {
  const source = {
    ...memory,
    founderPatternDiscovery: existing || null
  };
  if (!shouldGeneratePatternReport(source)) {
    return normalizePatternMemory(existing);
  }
  const report = discoverFounderPatterns(memory);
  const current = normalizePatternMemory(existing);
  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastConversationBucket: Math.floor(countConversationSignals(memory) / PATTERN_INTERVAL),
    lastReport: report,
    reports: [report, ...current.reports].slice(0, MAX_PATTERN_REPORTS)
  };
}

function discoverFounderPatterns(memory = {}) {
  const signalCount = countConversationSignals(memory);
  const repeatedFears = discoverFears(memory);
  const repeatedFrustrations = discoverFrustrations(memory);
  const repeatedGoals = discoverGoals(memory);
  const repeatedQuestions = discoverQuestions(memory);
  const unnoticedPatterns = discoverUnnoticedPatterns({
    repeatedFears,
    repeatedFrustrations,
    repeatedGoals,
    repeatedQuestions
  });

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    sourceConversationSignals: signalCount,
    repeatedFears,
    repeatedFrustrations,
    repeatedGoals,
    repeatedQuestions,
    unnoticedPatterns,
    confidence: confidenceFor(signalCount, [
      repeatedFears,
      repeatedFrustrations,
      repeatedGoals,
      repeatedQuestions
    ])
  };
}

function discoverFears(memory = {}) {
  const sources = [
    ...array(memory.founderDoubts).map((item) => `${item.concern || ''} ${item.objective || ''}`),
    ...array(memory.founderFeedback).map(textOf)
  ];
  return topMatchedPatterns(sources, [
    {
      pattern: 'building impressive systems instead of useful product value',
      regex: /impressive|architecture theatre|fake progress|useful product/i,
      implication: 'Challenge work that looks advanced but lacks user pull.'
    },
    {
      pattern: 'users may not care unless the wedge becomes habitual',
      regex: /users?.*care|user.*value|habit|return|daily/i,
      implication: 'Ask what repeated user moment proves the idea matters.'
    },
    {
      pattern: 'agents may still be template-driven instead of intelligent',
      regex: /template|generic|dumb|keyword|agents?.*understand|not relevant/i,
      implication: 'Prefer founder-objective reasoning over status or command parsing.'
    },
    {
      pattern: 'dream alignment may be drifting toward infrastructure',
      regex: /dream|vision|chasing|jarvis|intelligence layer|wrong thing/i,
      implication: 'Tie work back to the long-term personal intelligence layer.'
    }
  ]);
}

function discoverFrustrations(memory = {}) {
  const sources = [
    ...array(memory.founderFeedback).map(textOf),
    ...array(memory.recentMessages).map(textOf),
    ...array(memory.founderDoubts).map(textOf)
  ];
  return topMatchedPatterns(sources, [
    {
      pattern: 'health, momentum, and status templates appear in the wrong conversations',
      regex: /health|momentum|status|team ready|cto mode|report/i,
      implication: 'Status framing should be reserved for explicit status requests only.'
    },
    {
      pattern: 'answers feel generic when they do not name user pain',
      regex: /generic|vague|not specific|user pain|value/i,
      implication: 'Lead with the concrete user outcome or uncertainty.'
    },
    {
      pattern: 'execution machinery interrupts founder reflection',
      regex: /task plan|approve|execution|file|validation|route/i,
      implication: 'Reflective questions must bypass execution planning.'
    }
  ]);
}

function discoverGoals(memory = {}) {
  const sources = [
    ...array(memory.founderGoals).map((item) => `${item.objective || ''} ${item.actualQuestion || ''}`),
    ...array(memory.compressedFounderInsights).map((item) => `${item.insight || ''} ${item.implication || ''}`),
    ...array(memory.founderFeedback).map(textOf)
  ];
  return topMatchedPatterns(sources, [
    {
      pattern: 'build a personal intelligence layer through the keyboard',
      regex: /personal intelligence layer|jarvis|phone|keyboard|dream/i,
      implication: 'The keyboard is the distribution vehicle, not the whole ambition.'
    },
    {
      pattern: 'prove Explain creates user-facing leverage',
      regex: /explain|screenshot|understand|confusing|user-facing leverage/i,
      implication: 'Phase 2 should prove understanding-before-typing as a habit.'
    },
    {
      pattern: 'make agents useful while founder is absent',
      regex: /absent|school|30 days|without founder|agents improve/i,
      implication: 'Agents should surface high-signal evidence and avoid fake progress.'
    }
  ]);
}

function discoverQuestions(memory = {}) {
  const clustered = array(memory.founderQuestionClusters && memory.founderQuestionClusters.recentQuestions);
  const clusterPatterns = topBy(clustered, (item) => item.family || item.clusterId || item.messagePattern || 'unknown question')
    .map((item) => ({
      pattern: item.key,
      count: item.count,
      evidence: `${item.count} clustered founder questions.`,
      implication: 'Route this family by meaning before keywords.',
      confidence: confidenceFromCount(item.count)
    }));
  if (clusterPatterns.length) return clusterPatterns.slice(0, MAX_ITEMS_PER_SECTION);

  return topMatchedPatterns(array(memory.founderFeedback).map(textOf), [
    {
      pattern: 'dream alignment questions',
      regex: /dream|chasing|final goal|vision/i,
      implication: 'Founder repeatedly checks if current work still points at the real ambition.'
    },
    {
      pattern: 'user value questions',
      regex: /users?.*care|useful|value|pay|return/i,
      implication: 'Founder wants proof of pull, not impressive internal capability.'
    },
    {
      pattern: 'premortem questions',
      regex: /fail|dangerous assumption|risk|wrong/i,
      implication: 'Founder uses failure questions to expose weak strategy.'
    }
  ]);
}

function discoverUnnoticedPatterns({
  repeatedFears = [],
  repeatedFrustrations = [],
  repeatedGoals = [],
  repeatedQuestions = []
} = {}) {
  const text = [
    ...repeatedFears,
    ...repeatedFrustrations,
    ...repeatedGoals,
    ...repeatedQuestions
  ].map((item) => item.pattern).join(' ').toLowerCase();
  const patterns = [];
  if (/impressive|useful|users? may not care|user value/.test(text)) {
    patterns.push(patternItem({
      pattern: 'usefulness anxiety is stronger than feature anxiety',
      count: 2,
      implication: 'The founder is not mainly asking whether features can be built; he is asking whether users would care.'
    }));
  }
  if (/template|generic|health|momentum|status/.test(text)) {
    patterns.push(patternItem({
      pattern: 'agent capability anxiety shows up as anger at templates',
      count: 2,
      implication: 'Bad answers are interpreted as evidence that the company cannot be left to agents.'
    }));
  }
  if (/dream|personal intelligence layer|explain|keyboard/.test(text)) {
    patterns.push(patternItem({
      pattern: 'dream alignment is repeatedly tested through small product decisions',
      count: 2,
      implication: 'Every proposal should connect current work to the long-term intelligence-layer dream.'
    }));
  }
  if (!patterns.length) {
    patterns.push(patternItem({
      pattern: 'insufficient repeated signal for hidden founder patterns',
      count: 1,
      implication: 'Keep collecting feedback before claiming deeper pattern discovery.'
    }));
  }
  return patterns.slice(0, MAX_ITEMS_PER_SECTION);
}

function topMatchedPatterns(sources = [], candidates = []) {
  return candidates
    .map((candidate) => {
      const count = sources.filter((source) => candidate.regex.test(String(source || ''))).length;
      return patternItem({
        pattern: candidate.pattern,
        count,
        implication: candidate.implication
      });
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_ITEMS_PER_SECTION);
}

function patternItem({ pattern, count, implication }) {
  return {
    pattern,
    count,
    evidence: `${count} matching conversation signals.`,
    implication,
    confidence: confidenceFromCount(count)
  };
}

function normalizePatternMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastConversationBucket: Number(source.lastConversationBucket || 0),
    lastReport: source.lastReport || null,
    reports: array(source.reports).slice(0, MAX_PATTERN_REPORTS)
  };
}

function countConversationSignals(memory = {}) {
  return array(memory.founderFeedback).length +
    array(memory.recentMessages).length +
    array(memory.founderConcerns).length +
    array(memory.founderDoubts).length +
    array(memory.founderGoals).length +
    array(memory.founderDecisions).length +
    array(memory.founderQuestionClusters && memory.founderQuestionClusters.recentQuestions).length;
}

function topBy(items = [], keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function confidenceFor(signalCount, sections = []) {
  const populated = sections.filter((items) => array(items).length > 0).length;
  return Math.min(90, 52 + Math.floor(signalCount / 10) + populated * 6);
}

function confidenceFromCount(count) {
  return Math.min(88, 55 + Number(count || 0) * 4);
}

function textOf(item = {}) {
  return [
    item.rawQuestionPreview,
    item.rawAnswerPreview,
    item.questionPattern,
    item.answerPattern,
    item.feedback,
    item.sourceMessage,
    item.concern,
    item.objective,
    item.actualQuestion,
    item.summary
  ].filter(Boolean).join(' ');
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  discoverFounderPatterns,
  shouldGeneratePatternReport,
  updateFounderPatternDiscovery,
  countConversationSignals,
  normalizePatternMemory
};
