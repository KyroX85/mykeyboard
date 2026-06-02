function buildContrarianReasoning({
  message = '',
  intent = '',
  category = '',
  directAnswer = []
} = {}) {
  const text = normalize(`${message} ${intent} ${category} ${asArray(directAnswer).join(' ')}`);
  const domain = classifyContrarianDomain(text);
  const map = CONTRARIAN_DOMAIN_MAP[domain] || CONTRARIAN_DOMAIN_MAP.default;
  return {
    version: '1.0',
    domain,
    strongestCaseFor: map.strongestCaseFor,
    strongestCaseAgainst: map.strongestCaseAgainst,
    likelyReality: map.likelyReality,
    advisorBias: map.advisorBias,
    confidence: map.confidence
  };
}

function formatContrarianReasoning(reasoning = {}) {
  return [
    'Contrarian read:',
    `- Strongest case for: ${reasoning.strongestCaseFor || 'unknown'}`,
    `- Strongest case against: ${reasoning.strongestCaseAgainst || 'unknown'}`,
    `- Likely reality: ${reasoning.likelyReality || 'unknown'}`
  ].join('\n');
}

function responseUsesContrarianReasoning(response = '') {
  const text = String(response || '');
  return /Strongest case for:/i.test(text) &&
    /Strongest case against:/i.test(text) &&
    /Likely reality:/i.test(text);
}

function classifyContrarianDomain(text = '') {
  if (/\b(dream|vision|chasing|ambition|moving toward|wrong thing|misaligned)\b/.test(text)) {
    return 'vision_alignment';
  }
  if (/\b(users?\s+(do\s+not|don\s+t|dont|actually)?\s*care|user value|useful|impressive instead of useful|habit|pay|return)\b/.test(text)) {
    return 'user_value';
  }
  if (/\b(explain|screenshot|understanding before typing|execution layer|glass handle)\b/.test(text)) {
    return 'phase2_explain';
  }
  if (/\b(agents?|understand|routing|template|memory|intelligence|codex|council)\b/.test(text)) {
    return 'agent_intelligence';
  }
  if (/\b(fail|premortem|dangerous assumption|risk|bet against)\b/.test(text)) {
    return 'premortem';
  }
  return 'default';
}

const CONTRARIAN_DOMAIN_MAP = {
  vision_alignment: {
    strongestCaseFor: 'The current path is building the discipline, memory, and safety needed before a founder can trust agents with longer-horizon product work.',
    strongestCaseAgainst: 'The company can still drift into agent infrastructure while the user-facing reason to install Aritenis remains unproven.',
    likelyReality: 'The infrastructure is useful only if it quickly sharpens one user-visible Explain moment; otherwise it becomes impressive preparation without product pull.',
    advisorBias: 'challenge infrastructure that is not tied to user proof',
    confidence: 84
  },
  user_value: {
    strongestCaseFor: 'Users do face repeated confusing moments, and a keyboard-side Explain action could reduce friction at the exact moment they need to respond.',
    strongestCaseAgainst: 'Users may not care enough to switch keyboards if Explain feels optional, slower than opening ChatGPT, or too privacy-sensitive.',
    likelyReality: 'The idea has leverage, but only a narrow repeated use case with clear speed and trust advantage will matter.',
    advisorBias: 'demand proof of repeated user pain',
    confidence: 85
  },
  phase2_explain: {
    strongestCaseFor: 'Explain is a real differentiator because it moves Aritenis beyond typing assistance into understanding-before-typing.',
    strongestCaseAgainst: 'A broad execution layer can become vague AI surface area before the first habit-forming Explain workflow is proven.',
    likelyReality: 'The safest wedge is one explicit, temporary, confirm-before-send screenshot Explain flow, not a general companion platform.',
    advisorBias: 'favor the narrowest habit proof',
    confidence: 86
  },
  agent_intelligence: {
    strongestCaseFor: 'Better agents can reduce founder load, preserve context, and keep the roadmap honest while the founder is absent.',
    strongestCaseAgainst: 'Smarter routing does not matter if the agents still fail to create product evidence or answer founder concerns directly.',
    likelyReality: 'Agent intelligence is valuable as a support system, but it must be judged by product decisions improved, not layers added.',
    advisorBias: 'judge agents by founder-facing usefulness',
    confidence: 83
  },
  premortem: {
    strongestCaseFor: 'The current caution around trust, privacy, and typing foundation reduces the chance of catastrophic product damage.',
    strongestCaseAgainst: 'The bigger failure mode may be not shipping a compelling daily-use wedge, not technical instability.',
    likelyReality: 'Aritenis fails if it stays safe and impressive but never becomes behaviorally necessary.',
    advisorBias: 'separate safety from usefulness',
    confidence: 86
  },
  default: {
    strongestCaseFor: 'The founder question may have a valid optimistic interpretation that supports the current direction.',
    strongestCaseAgainst: 'The same question may expose a hidden assumption, weak user proof, or opportunity cost.',
    likelyReality: 'A useful answer should hold both sides briefly, then state the practical judgment instead of validating one side.',
    advisorBias: 'prefer balanced strategic judgment',
    confidence: 76
  }
};

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  buildContrarianReasoning,
  formatContrarianReasoning,
  responseUsesContrarianReasoning
};
