const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_CONVERSATIONS_TO_COMPRESS = 50;
const MAX_DURABLE_INSIGHTS = 5;
const MAX_FEEDBACK_AFTER_COMPRESSION = 20;

function shouldCompressFounderMemory(memory = {}, now = new Date()) {
  const sourceCount = countConversationSources(memory);
  if (sourceCount < MIN_CONVERSATIONS_TO_COMPRESS) return false;
  const lastCompressedAt = memory.memoryCompression && memory.memoryCompression.lastCompressedAt;
  if (!lastCompressedAt) return true;
  const last = Date.parse(lastCompressedAt);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= WEEK_MS;
}

function compressFounderMemory(memory = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  if (!shouldCompressFounderMemory(memory, now)) return memory;

  const sourceCount = countConversationSources(memory);
  const insights = buildDurableInsights(memory, now).slice(0, MAX_DURABLE_INSIGHTS);
  const previous = normalizeInsights(memory.compressedFounderInsights);
  const mergedInsights = mergeInsights(insights, previous).slice(0, MAX_DURABLE_INSIGHTS);
  const previousCompression = memory.memoryCompression || {};

  return {
    ...memory,
    compressedFounderInsights: mergedInsights,
    founderFeedback: Array.isArray(memory.founderFeedback)
      ? memory.founderFeedback.slice(0, MAX_FEEDBACK_AFTER_COMPRESSION)
      : [],
    memoryCompression: {
      version: '1.0',
      lastCompressedAt: now.toISOString(),
      compressionCount: (previousCompression.compressionCount || 0) + 1,
      sourceConversationCount: sourceCount,
      retainedInsightCount: mergedInsights.length
    }
  };
}

function buildDurableInsights(memory = {}, now = new Date()) {
  const feedback = Array.isArray(memory.founderFeedback) ? memory.founderFeedback : [];
  const questionClusters = memory.founderQuestionClusters || {};
  const recentQuestions = Array.isArray(questionClusters.recentQuestions) ? questionClusters.recentQuestions : [];
  const wrongAnswer = memory.wrongAnswerAnalysis || {};

  const insights = [];
  const clusterCounts = countBy(recentQuestions, (item) => item.family || item.clusterId || 'unknown questions');
  const topCluster = topEntry(clusterCounts);
  if (topCluster) {
    insights.push(durableInsight({
      type: 'question_family',
      insight: `Founder repeatedly returns to ${topCluster.key}.`,
      evidence: `${topCluster.count} recent clustered questions.`,
      implication: 'Route future answers by intent family first, not isolated keywords.',
      confidence: confidence(topCluster.count, 90),
      now
    }));
  }

  const wrongCounts = wrongAnswer.failureCounts && typeof wrongAnswer.failureCounts === 'object'
    ? wrongAnswer.failureCounts
    : {};
  const topFailure = topEntry(wrongCounts);
  if (topFailure) {
    insights.push(durableInsight({
      type: 'answer_failure',
      insight: `Most repeated rejected-answer failure is ${readable(topFailure.key)}.`,
      evidence: `${topFailure.count} recorded failure signals.`,
      implication: 'Before replying, check this failure mode against the founder question.',
      confidence: confidence(topFailure.count, 88),
      now
    }));
  }

  const dreamCount = feedback.filter((item) => /dream|vision|chasing|jarvis|intelligence layer/i.test(textOf(item))).length;
  if (dreamCount) {
    insights.push(durableInsight({
      type: 'founder_dream',
      insight: 'Founder is optimizing for the long-term Aritenis dream, not agent machinery.',
      evidence: `${dreamCount} memory items mention dream, vision, chasing, or intelligence-layer ambition.`,
      implication: 'Tie strategic answers back to user leverage and the Explain wedge.',
      confidence: confidence(dreamCount, 86),
      now
    }));
  }

  const userValueCount = feedback.filter((item) => /user|care|useful|value|pain|behavior|habit/i.test(textOf(item))).length;
  if (userValueCount) {
    insights.push(durableInsight({
      type: 'user_value',
      insight: 'Founder distrusts impressive work unless it proves user value.',
      evidence: `${userValueCount} memory items reference users, usefulness, value, pain, or behavior.`,
      implication: 'Answer with the user outcome first, then technical context only if needed.',
      confidence: confidence(userValueCount, 86),
      now
    }));
  }

  const templateCount = feedback.filter((item) => /health|momentum|team ready|status|template|cto mode|generic/i.test(textOf(item))).length;
  if (templateCount) {
    insights.push(durableInsight({
      type: 'template_rejection',
      insight: 'Founder rejects status-template answers for reflective or strategic questions.',
      evidence: `${templateCount} memory items mention template-like or status-like answer failures.`,
      implication: 'Conversation answers should start with the hidden concern, not health or momentum language.',
      confidence: confidence(templateCount, 88),
      now
    }));
  }

  return fillInsights(insights, now);
}

function fillInsights(insights = [], now = new Date()) {
  const next = [...insights];
  const defaults = [
    {
      type: 'memory_quality',
      insight: 'Founder memory should preserve durable judgment, not every conversational detail.',
      evidence: 'Compression ran after enough founder conversation records accumulated.',
      implication: 'Keep five high-signal insights and let short-term records expire.',
      confidence: 72
    },
    {
      type: 'product_direction',
      insight: 'Aritenis direction should stay anchored to trust, Explain, and real user leverage.',
      evidence: 'Founder memory repeatedly penalizes architecture theater and fake progress.',
      implication: 'Avoid proposing complexity unless it moves the current wedge forward.',
      confidence: 76
    }
  ];
  for (const item of defaults) {
    if (next.length >= MAX_DURABLE_INSIGHTS) break;
    next.push(durableInsight({ ...item, now }));
  }
  return next;
}

function durableInsight({ type, insight, evidence, implication, confidence: score, now }) {
  return {
    timestamp: now.toISOString(),
    type,
    insight,
    evidence,
    implication,
    confidence: Math.min(90, Math.max(0, score || 60))
  };
}

function mergeInsights(current = [], previous = []) {
  const seen = new Set();
  const merged = [];
  for (const item of [...current, ...previous]) {
    const key = String(item.type || item.insight || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function countConversationSources(memory = {}) {
  return array(memory.founderFeedback).length +
    array(memory.recentMessages).length +
    array(memory.founderConcerns).length +
    array(memory.founderDoubts).length +
    array(memory.founderGoals).length +
    array(memory.founderDecisions).length +
    array(memory.founderQuestionClusters && memory.founderQuestionClusters.recentQuestions).length;
}

function countBy(items = [], keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function topEntry(counts = {}) {
  const ranked = Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  return ranked[0] || null;
}

function textOf(item = {}) {
  return [
    item.rawQuestionPreview,
    item.rawAnswerPreview,
    item.questionPattern,
    item.answerPattern,
    item.feedback,
    item.sourceMessage
  ].filter(Boolean).join(' ');
}

function normalizeInsights(items) {
  return array(items).filter((item) => item && item.insight);
}

function confidence(count, cap) {
  return Math.min(cap, 58 + count * 3);
}

function readable(value = '') {
  return String(value || '').replace(/_/g, ' ');
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  compressFounderMemory,
  shouldCompressFounderMemory,
  buildDurableInsights,
  countConversationSources
};
