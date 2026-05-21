const AGENT_ALIASES = new Map([
  ['cto', 'cto'],
  ['chief', 'cto'],
  ['lead', 'cto'],
  ['manager', 'cto'],
  ['coder', 'coder'],
  ['dev', 'coder'],
  ['developer', 'coder'],
  ['engineer', 'coder'],
  ['reviewer', 'reviewer'],
  ['review', 'reviewer'],
  ['qa', 'reviewer'],
  ['auditor', 'auditor'],
  ['auditer', 'auditor'],
  ['audit', 'auditor'],
  ['auditing', 'auditor'],
  ['security', 'auditor']
]);

const INTENT_PATTERNS = [
  { intent: 'execution', words: ['execution', 'executed', 'approved', 'blocked execution', 'rollback', 'rolled back'] },
  { intent: 'summary', words: ['summarize', 'summary', 'today', 'overall', 'brief', 'update', 'happened'] },
  { intent: 'tasks', words: ['task', 'tasks', 'assigned', 'assignment', 'pipeline'] },
  { intent: 'blocked_tasks', words: ['blocked items', 'blocked tasks', 'blockers'] },
  { intent: 'maintenance', words: ['maintenance', 'cleaned', 'cleanup', 'clean', 'safe maintenance'] },
  { intent: 'risks', words: ['risk', 'risks', 'danger', 'dangerous', 'concern', 'issue', 'blocked', 'blocker', 'blocks'] },
  { intent: 'current_work', words: ['doing', 'working', 'work', 'progress', 'touched', 'changed'] },
  { intent: 'validation', words: ['validate', 'validation', 'test', 'tests', 'build', 'lint'] },
  { intent: 'approvals', words: ['approval', 'approvals', 'approve', 'pending'] },
  { intent: 'priority', words: ['priority', 'priorities', 'next', 'focus'] },
  { intent: 'health', words: ['health', 'score', 'status'] },
  { intent: 'help', words: ['help', 'commands'] }
];

function parseNaturalIntent(message, memory = {}) {
  const normalized = normalize(message);
  if (!normalized) {
    return { matched: false, agent: null, intent: 'malformed', topic: null, confidence: 0, normalized };
  }

  const explicitAgent = detectAgent(normalized);
  const agent = explicitAgent || memory.lastAgentInteraction || null;
  const focusTopic = detectFocusTopic(normalized);
  const continuity = detectContinuity(normalized);
  const intent = detectIntent(normalized);
  const conversational = Boolean(
    agent ||
    intent !== 'unknown' ||
    focusTopic ||
    continuity.painPoint ||
    (continuity.founderTone && continuity.founderTone !== 'direct')
  );

  if (!conversational) {
    return { matched: false, agent: null, intent: 'unknown', topic: null, confidence: 0, normalized };
  }

  return {
    matched: true,
    agent: agent || 'cto',
    intent,
    topic: focusTopic || continuity.painPoint || memory.lastFocusTopic || memory.lastRequestedFocusArea || null,
    detailMode: detectDetailMode(normalized),
    continuity,
    confidence: explicitAgent ? (intent === 'unknown' ? 0.72 : 0.92) : 0.65,
    normalized,
    explicitAgent: explicitAgent || null,
    fallbackUsed: Boolean(explicitAgent && intent === 'unknown'),
    fallbackReason: explicitAgent && intent === 'unknown' ? 'agent_keyword_only' : null
  };
}

function detectDetailMode(normalized) {
  return /\b(full report|full|detailed|explain fully|explain|why|deep dive)\b/.test(normalized);
}

function normalize(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function detectAgent(normalized) {
  const words = normalized.split(' ');
  for (const word of words) {
    if (AGENT_ALIASES.has(word)) return AGENT_ALIASES.get(word);
  }
  return null;
}

function detectIntent(normalized) {
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.words.some((word) => normalized.includes(word))) return pattern.intent;
  }
  if (/what'?s going on|whats going on|what is going on/.test(normalized)) return 'summary';
  if (/what changed today|what happened today/.test(normalized)) return 'summary';
  if (/\b(stuck|improving|progress iruka|inniku progress|fixed ah|fix ah)\b/.test(normalized)) return 'current_work';
  return 'unknown';
}

function detectContinuity(normalized) {
  const tone = /\b(dei|bro|da|dai|machan)\b/.test(normalized)
    ? 'casual'
    : /\b(tired|exhausted|school|class|busy)\b/.test(normalized)
      ? 'low_attention'
      : 'direct';
  const painPoints = [];
  if (/\bswipe|trail|gesture\b/.test(normalized)) painPoints.push('swipe feel');
  if (/\btyping feel|gboard|keyboard feel|keypress|latency\b/.test(normalized)) painPoints.push('typing feel');
  if (/\brobotic|template|bot|worker feel|real worker\b/.test(normalized)) painPoints.push('real worker feel');
  if (/\bschool|class\b/.test(normalized)) painPoints.push('school mode');
  return {
    founderTone: tone,
    painPoint: painPoints[0] || null,
    frustration: painPoints.length ? painPoints[0] : null,
    preferredWording: tone === 'casual' ? 'sir' : null
  };
}

function detectFocusTopic(normalized) {
  const focusMatch = normalized.match(/\bfocus\s+(.+)$/);
  if (focusMatch) return focusMatch[1].trim().slice(0, 80);

  const aboutMatch = normalized.match(/\b(?:about|on|for)\s+([a-z0-9_\-\s]{3,80})$/);
  if (aboutMatch) return aboutMatch[1].trim();

  return null;
}

module.exports = {
  parseNaturalIntent,
  normalize,
  detectAgent,
  detectIntent,
  detectDetailMode,
  detectContinuity
};
