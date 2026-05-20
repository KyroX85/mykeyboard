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
  ['audit', 'auditor'],
  ['security', 'auditor']
]);

const INTENT_PATTERNS = [
  { intent: 'summary', words: ['summarize', 'summary', 'today', 'overall', 'brief', 'update', 'happened'] },
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
    return { matched: false, agent: null, intent: 'malformed', topic: null, confidence: 0 };
  }

  const agent = detectAgent(normalized) || memory.lastAgentInteraction || null;
  const focusTopic = detectFocusTopic(normalized);
  const intent = detectIntent(normalized);
  const conversational = Boolean(agent || intent !== 'unknown' || focusTopic);

  if (!conversational) {
    return { matched: false, agent: null, intent: 'unknown', topic: null, confidence: 0 };
  }

  return {
    matched: true,
    agent: agent || 'cto',
    intent,
    topic: focusTopic || memory.lastFocusTopic || memory.lastRequestedFocusArea || null,
    confidence: agent ? 0.9 : 0.65
  };
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
  return 'unknown';
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
  detectIntent
};
