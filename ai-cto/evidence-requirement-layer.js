const MAX_EVIDENCE_CHECKS = 50;

function shouldRequireEvidence(claim = '', context = {}) {
  const text = claimText(claim, context).toLowerCase();
  if (!text.trim() || text.length < 24) return false;
  if (/^(ok|yes|no|maybe|thanks)$/i.test(text.trim())) return false;

  return /\b(you are|you keep|you repeatedly|founder|dream|vision|understand|clearly|always|never|proven|definitely|users will|users do|company|strategy|product truth|optimizing|evolved|changed)\b/.test(text);
}

function evaluateEvidenceRequirement(claim = '', context = {}) {
  const text = claimText(claim, context).trim();
  const evidence = {
    memory: collectMemoryEvidence(context),
    conversation: collectConversationEvidence(context),
    behavior: collectBehaviorEvidence(context)
  };
  const missingEvidence = [];
  if (!evidence.memory.length) missingEvidence.push('memory evidence');
  if (!evidence.conversation.length) missingEvidence.push('conversation evidence');
  if (!evidence.behavior.length) missingEvidence.push('behavior evidence');

  const status = missingEvidence.length ? 'DOWNGRADE_REQUIRED' : 'EVIDENCE_SUPPORTED';

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    claimPreview: text.slice(0, 260),
    status,
    evidence,
    missingEvidence,
    claimGuidance: guidanceFor(status, missingEvidence),
    confidence: confidenceFor(status, evidence, missingEvidence)
  };
}

function updateEvidenceRequirementMemory(existing = {}, check = null) {
  const memory = normalizeEvidenceRequirementMemory(existing);
  if (!check) return memory;
  const recentChecks = [
    check,
    ...memory.recentChecks.filter((item) => {
      return item.claimPreview !== check.claimPreview || item.status !== check.status;
    })
  ].slice(0, MAX_EVIDENCE_CHECKS);

  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    lastCheck: check,
    recentChecks,
    statusCounts: countByStatus(recentChecks)
  };
}

function normalizeEvidenceRequirementMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const recentChecks = Array.isArray(source.recentChecks) ? source.recentChecks : [];
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    lastCheck: source.lastCheck || null,
    recentChecks: recentChecks.filter(Boolean).slice(0, MAX_EVIDENCE_CHECKS),
    statusCounts: source.statusCounts && typeof source.statusCounts === 'object'
      ? source.statusCounts
      : countByStatus(recentChecks)
  };
}

function collectMemoryEvidence(context = {}) {
  const memory = context.founderMemory || context.memory || {};
  return unique([
    ...asEvidence(memory.founderGoal, 'founder goal'),
    ...asEvidence(memory.founderGoals, 'founder goals'),
    ...asEvidence(memory.founderRejectedPatterns, 'rejected patterns'),
    ...asEvidence(memory.founderTasteModel && memory.founderTasteModel.repeatedLikes, 'founder taste likes'),
    ...asEvidence(memory.founderTasteModel && memory.founderTasteModel.repeatedRejects, 'founder taste rejects'),
    ...asEvidence(memory.founderMentalStateMemory && memory.founderMentalStateMemory.lastState, 'mental state memory'),
    ...asEvidence(memory.founderBeliefTracker && memory.founderBeliefTracker.lastShift, 'belief tracker'),
    ...asEvidence(memory.compressedFounderInsights, 'compressed founder insights')
  ]).slice(0, 6);
}

function collectConversationEvidence(context = {}) {
  return unique([
    ...asEvidence(context.founderMessage, 'current founder message'),
    ...asEvidence(context.previousFounderQuestion, 'previous founder question'),
    ...asEvidence(context.previousAgentAnswer, 'previous agent answer'),
    ...asEvidence(context.recentMessages, 'recent conversation'),
    ...asEvidence(context.memory && context.memory.recentMessages, 'memory recent conversation')
  ]).slice(0, 6);
}

function collectBehaviorEvidence(context = {}) {
  return unique([
    ...asEvidence(context.behaviorEvidence, 'behavior evidence'),
    ...asEvidence(context.founderFeedback, 'founder feedback'),
    ...asEvidence(context.lastFeedback, 'last founder feedback'),
    ...asEvidence(context.memory && context.memory.founderFeedback, 'memory founder feedback'),
    ...asEvidence(context.memory && context.memory.wrongAnswerAnalysis, 'wrong answer analysis'),
    ...asEvidence(context.memory && context.memory.reinforcementEvents, 'route rewards')
  ]).slice(0, 6);
}

function asEvidence(value, label) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .slice(0, 4)
      .map((item) => `${label}: ${summarize(item)}`);
  }
  if (typeof value === 'object') {
    const summary = summarize(value);
    return summary ? [`${label}: ${summary}`] : [];
  }
  return [`${label}: ${summarize(value)}`];
}

function summarize(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, 180);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const fields = [
    value.summary,
    value.founderMessage,
    value.question,
    value.answerPattern,
    value.feedback,
    value.primaryState,
    value.objective,
    value.concern,
    value.belief,
    value.insight,
    value.routeKey,
    value.rewardLabel
  ].filter(Boolean);
  if (fields.length) return fields.join(' | ').slice(0, 180);
  try {
    return JSON.stringify(value).slice(0, 180);
  } catch {
    return '';
  }
}

function guidanceFor(status, missingEvidence) {
  if (status === 'EVIDENCE_SUPPORTED') {
    return 'Strong claim can be made, but cite the memory, conversation, and behavior evidence explicitly.';
  }
  return `Downgrade the claim. Say it is uncertain until ${missingEvidence.join(', ')} exists.`;
}

function confidenceFor(status, evidence, missingEvidence) {
  if (status === 'EVIDENCE_SUPPORTED') return 84;
  const evidenceCount = Object.values(evidence).reduce((total, items) => total + items.length, 0);
  return Math.max(35, Math.min(72, 42 + evidenceCount * 6 - missingEvidence.length * 5));
}

function countByStatus(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.status ? item.status : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function claimText(claim, context = {}) {
  return String(
    claim ||
    context.agentAnswer ||
    context.response ||
    context.claim ||
    ''
  );
}

module.exports = {
  shouldRequireEvidence,
  evaluateEvidenceRequirement,
  updateEvidenceRequirementMemory,
  normalizeEvidenceRequirementMemory
};
