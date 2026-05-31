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
  { intent: 'praise', words: ['good job', 'well done', 'nice work', 'nalla iruka', 'super da', 'great work'] },
  { intent: 'check_in', words: ['you there', 'anyone home', 'team there', 'are you there'] },
  { intent: 'direction', words: ['what should we do', 'next steps', 'what next', 'what do we do', 'your call', 'guide me'] },
  { intent: 'recent_fix_question', words: ['what did you just fix', 'what was fixed', 'what you fixed', 'just fixed', 'what changed just now'] },
  { intent: 'status_question', words: [
    'whats going on',
    'what is going on',
    'hows going on',
    'how is it going',
    'how is going',
    'hows it going',
    'how are we doing',
    'how work is going',
    'how is work going',
    'work is going',
    'work going',
    'work epdi poguthu',
    'work eppadi poguthu',
    'epdi poguthu',
    'eppadi poguthu',
    'everything okay',
    'all going fine',
    'status enna',
    'enna panreenga',
    'enna panringa',
    'what happened'
  ] },
  { intent: 'execution', words: ['execution', 'executed', 'approved', 'blocked execution', 'rollback', 'rolled back'] },
  { intent: 'summary', words: ['summarize', 'summary', 'today', 'overall', 'brief', 'update', 'happened'] },
  { intent: 'tasks', words: ['task', 'tasks', 'assigned', 'assignment', 'pipeline'] },
  { intent: 'blocked_tasks', words: ['blocked items', 'blocked tasks', 'blockers'] },
  { intent: 'maintenance', words: ['maintenance', 'cleaned', 'cleanup', 'clean', 'safe maintenance'] },
  { intent: 'operational', words: ['operational', 'assist', 'assistance', 'product signal', 'runtime health', 'fake progress', 'founder load'] },
  { intent: 'risks', words: ['risk', 'risks', 'danger', 'dangerous', 'concern', 'issue', 'blocked', 'blocker', 'blocks'] },
  { intent: 'current_work', words: ['doing', 'working', 'work', 'progress', 'touched', 'changed'] },
  { intent: 'validation', words: ['validate', 'validation', 'test', 'tests', 'build', 'lint'] },
  { intent: 'approvals', words: ['approval', 'approvals', 'approve', 'pending'] },
  { intent: 'priority', words: ['priority', 'priorities', 'next', 'focus'] },
  { intent: 'health', words: ['health', 'score', 'status'] },
  { intent: 'help', words: ['help', 'commands'] },
  { intent: 'greeting', words: ['hi', 'hello', 'sup', 'hey', 'da', 'bro', 'enna', 'என்ன', 'vanakkam'] }
];

const GREETING_WORDS = new Set(['hi', 'hello', 'sup', 'bro', 'da', 'hey', 'enna', '\u0b8e\u0ba9\u0bcd\u0ba9', 'vanakkam']);
const GREETING_FILLERS = new Set(['sir', 'founder', 'team']);

function parseNaturalIntent(message, memory = {}) {
  const normalized = normalize(message);
  if (!normalized) {
    return { matched: false, agent: null, intent: 'malformed', topic: null, confidence: 0, normalized };
  }

  if (isStandaloneGreeting(normalized)) {
    return {
      matched: true,
      agent: 'cto',
      intent: 'greeting',
      topic: null,
      detailMode: false,
      continuity: detectContinuity(normalized),
      confidence: 1,
      normalized,
      explicitAgent: null,
      fallbackUsed: false,
      fallbackReason: null
    };
  }

  const explicitAgent = detectAgent(normalized);
  const directive = detectDirective(normalized);
  const agent = explicitAgent || memory.lastAgentInteraction || null;
  const focusTopic = detectFocusTopic(normalized);
  const continuity = detectContinuity(normalized);
  const semanticTopic = resolveTopicFromContinuity(continuity, memory);
  const crossAgentAudit = detectCrossAgentAudit(normalized, explicitAgent);
  const detectedIntent = directive ? 'directive' : crossAgentAudit ? 'cross_agent_audit' : detectIntent(normalized);
  const intent = explicitAgent && detectedIntent === 'greeting' ? 'unknown' : detectedIntent;
  const conversational = Boolean(
    agent ||
    intent !== 'unknown' ||
    focusTopic ||
    semanticTopic ||
    continuity.referenceTerm ||
    continuity.continuationRequested ||
    continuity.statusCheck ||
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
    topic: (crossAgentAudit && crossAgentAudit.topic) || focusTopic || semanticTopic || continuity.painPoint || memory.lastFocusTopic || memory.lastRequestedFocusArea || null,
    detailMode: detectDetailMode(normalized),
    continuity,
    confidence: explicitAgent ? (intent === 'unknown' ? 0.72 : 0.92) : 0.65,
    normalized,
    directive,
    crossAgentAudit,
    explicitAgent: explicitAgent || null,
    fallbackUsed: Boolean(explicitAgent && intent === 'unknown'),
    fallbackReason: explicitAgent && intent === 'unknown' ? 'agent_keyword_only' : null
  };
}

function detectCrossAgentAudit(normalized, explicitAgent) {
  if (!explicitAgent) return null;
  const otherAgent = (normalized.match(/\b(cto|coder|dev|developer|reviewer|auditor|audit)\b/g) || [])
    .map((word) => AGENT_ALIASES.get(word) || word)
    .find((agent) => agent && agent !== explicitAgent);
  if (!otherAgent) return null;
  if (!/\b(check|audit|review|find|see)\b/.test(normalized)) return null;
  if (!/\b(missed|miss|left|forgot|gap|wrong|risk|issue|bug)\b/.test(normalized)) return null;
  return {
    sourceAgent: explicitAgent,
    targetAgent: otherAgent,
    topic: `${otherAgent} missed work`
  };
}

function detectDirective(normalized) {
  const target = detectDirectiveTarget(normalized);
  if (!target) return null;

  const action = detectDirectiveAction(normalized);
  const topic = detectDirectiveTopic(normalized, action);
  return {
    targetAgent: target,
    action,
    topic,
    original: normalized
  };
}

function detectDirectiveTarget(normalized) {
  const directivePattern = /\b(tell|ask|make|send|assign|call)\s+(the\s+)?(cto|coder|dev|developer|reviewer|auditor|audit)\b/;
  const match = normalized.match(directivePattern);
  if (!match) return null;
  return AGENT_ALIASES.get(match[3]) || null;
}

function detectDirectiveAction(normalized) {
  if (/\b(check|scan|look|find|detect|see)\b.*\b(new\s+)?(issue|issues|risk|risks|bug|bugs)\b/.test(normalized)) {
    return 'check_new_issues';
  }
  if (/\b(fix|solve|clear)\b/.test(normalized)) return 'fix_issue';
  if (/\b(validate|test|build|lint)\b/.test(normalized)) return 'validate';
  if (/\b(review|check)\b/.test(normalized)) return 'review';
  return 'follow_instruction';
}

function detectDirectiveTopic(normalized, action) {
  if (action === 'check_new_issues') return 'new issues';
  const match = normalized.match(/\b(?:about|for|on|to)\s+(.+)$/);
  if (!match) return action.replace(/_/g, ' ');
  return match[1].replace(/^(check|scan|find|fix|review|validate)\s+/, '').trim().slice(0, 80);
}

function detectDetailMode(normalized) {
  return /\b(full report|full|detailed|explain fully|explain|why|deep dive)\b/.test(normalized);
}

function normalize(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u0b80-\u0bff-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function detectAgent(normalized) {
  const words = normalized.split(' ');
  for (const word of words) {
    if (AGENT_ALIASES.has(word)) return AGENT_ALIASES.get(word);
  }
  return null;
}

function isStandaloneGreeting(message) {
  const normalized = normalize(message);
  if (!normalized) return false;
  const words = normalized.split(' ').filter(Boolean);
  if (words.some((word) => AGENT_ALIASES.has(word))) return false;
  return words.length > 0 && words.every((word) =>
    GREETING_WORDS.has(word) || GREETING_FILLERS.has(word)
  );
}

function detectIntent(normalized) {
  const casualStatus = detectCasualStatusIntent(normalized);
  if (casualStatus) return casualStatus;

  for (const pattern of INTENT_PATTERNS) {
    if (pattern.words.some((word) => matchesIntentWord(normalized, word))) return pattern.intent;
  }
  if (/what'?s going on|whats going on|what is going on|how are we doing|update me/.test(normalized)) return 'summary';
  if (/what changed today|what happened today/.test(normalized)) return 'summary';
  if (/\b(stuck|improving|progress iruka|inniku progress|fixed ah|fix ah|fix|continue|still broken|same issue|after that)\b/.test(normalized)) return 'current_work';
  return 'unknown';
}

function detectCasualStatusIntent(normalized) {
  if (/\b(bro|da|dei|dai|machan)?\s*(hows\s+(it\s+)?going|how\s+(is\s+)?(it\s+)?going|how\s+(is\s+)?work\s+(is\s+)?going|work\s+(epdi|eppadi)\s+poguthu|epdi\s+poguthu|eppadi\s+poguthu|everything\s+okay(\s+ah)?|all\s+going\s+fine(\s+ah)?|status\s+enna|enna\s+panreenga|enna\s+panringa)\b/.test(normalized)) {
    return 'status_question';
  }
  return null;
}

function matchesIntentWord(normalized, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[a-z0-9-]+$/.test(word)) return new RegExp(`\\b${escaped}\\b`).test(normalized);
  return normalized.includes(word);
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
  const referenceMatch = normalized.match(/\b(this|that|them|it)\b/);
  const continuationRequested = /\b(continue|after that|what happened after that|what happened next)\b/.test(normalized);
  const statusCheck = /\b(still broken|fixed ah|fix ah|fixed|stuck|same issue)\b/.test(normalized);
  const requestedAction = detectRequestedAction(normalized, continuationRequested, statusCheck);
  return {
    normalized,
    founderTone: tone,
    painPoint: painPoints[0] || null,
    frustration: painPoints.length ? painPoints[0] : null,
    preferredWording: tone === 'casual' ? 'sir' : null,
    preferredResponseStyle: tone === 'low_attention' || /\bschool|class\b/.test(normalized)
      ? 'mobile-first short worker updates'
      : null,
    referenceTerm: referenceMatch ? referenceMatch[1] : null,
    continuationRequested,
    statusCheck,
    requestedAction,
    desiredOutcome: detectDesiredOutcome(normalized, painPoints[0])
  };
}

function detectRequestedAction(normalized, continuationRequested, statusCheck) {
  if (/\bfix\b/.test(normalized)) return 'fix';
  if (/\bvalidate|test|check\b/.test(normalized)) return 'validate';
  if (continuationRequested) return 'continue';
  if (statusCheck) return 'check_status';
  return null;
}

function detectDesiredOutcome(normalized, painPoint) {
  if (/\bpremium|smooth|gboard|typing feel|keyboard feel\b/.test(normalized)) return 'make the keyboard feel premium and stable';
  if (/\breduce founder|cognitive|school|short\b/.test(normalized)) return 'reduce founder cognitive load';
  if (painPoint === 'swipe feel') return 'make swipe reliability trustworthy';
  if (painPoint === 'typing feel') return 'make typing confidence stronger';
  return null;
}

function resolveTopicFromContinuity(continuity, memory = {}) {
  if (continuity.referenceTerm || continuity.continuationRequested || continuity.statusCheck) {
    return memory.unresolvedReference ||
      memory.activeFocus ||
      memory.activeRuntimeProblem ||
      memory.lastFocusTopic ||
      memory.lastRequestedFocusArea ||
      memory.lastUnfinishedConcern ||
      null;
  }
  return null;
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
  detectDirective,
  detectCrossAgentAudit,
  isStandaloneGreeting,
  detectCasualStatusIntent,
  detectDetailMode,
  detectContinuity
};
