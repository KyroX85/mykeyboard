function buildStrategicThinking({
  message = '',
  category = '',
  intent = '',
  directAnswer = [],
  currentPhase = ''
} = {}) {
  const text = `${message} ${category} ${intent} ${asArray(directAnswer).join(' ')} ${currentPhase}`.toLowerCase();
  const domain = classifyStrategicDomain(text);
  const map = STRATEGIC_DOMAIN_MAP[domain] || STRATEGIC_DOMAIN_MAP.default;
  return {
    domain,
    firstOrderConsequence: map.firstOrderConsequence,
    secondOrderConsequence: map.secondOrderConsequence,
    opportunityCost: map.opportunityCost,
    alternativePath: map.alternativePath,
    ctoBias: map.ctoBias,
    confidence: map.confidence
  };
}

function formatStrategicThinking(thinking = {}) {
  return [
    'Strategic read:',
    `- First-order consequence: ${thinking.firstOrderConsequence || 'unknown'}`,
    `- Second-order consequence: ${thinking.secondOrderConsequence || 'unknown'}`,
    `- Opportunity cost: ${thinking.opportunityCost || 'unknown'}`,
    `- Alternative path: ${thinking.alternativePath || 'unknown'}`
  ].join('\n');
}

function responseUsesStrategicThinking(response = '') {
  const text = String(response || '');
  return /First-order consequence:/i.test(text) &&
    /Second-order consequence:/i.test(text) &&
    /Opportunity cost:/i.test(text) &&
    /Alternative path:/i.test(text);
}

function classifyStrategicDomain(text = '') {
  if (/\b(same founder|3 months ago|founder evolution|product-truth mode|builder-survival mode)\b/.test(text)) {
    return 'founder_evolution';
  }
  if (/\b(wrong thing|wrong direction|misaligned|dream|vision|chasing|ambition|killer feature)\b/.test(text)) {
    return 'vision_alignment';
  }
  if (/\b(explain|screenshot|understand|confusing|glass handle|execution layer|action surface)\b/.test(text)) {
    return 'phase2_explain';
  }
  if (/\b(implement|execute|fix|modify|edit|commit|rewrite|hot path|keyboardservice|predictor|swipe)\b/.test(text)) {
    return 'execution_risk';
  }
  if (/\b(how'?s going|what are you monitoring|status|health|momentum|progress|fake progress)\b/.test(text)) {
    return 'progress_reality';
  }
  if (/\b(agents?|understand|template|rule based|memory|intent|question)\b/.test(text)) {
    return 'agent_intelligence';
  }
  return 'default';
}

const STRATEGIC_DOMAIN_MAP = {
  founder_evolution: {
    firstOrderConsequence: 'Recognizing founder evolution helps separate useful sharper taste from random direction changes.',
    secondOrderConsequence: 'If the agents miss that evolution, they will keep answering the old company problem instead of the current one.',
    opportunityCost: 'Treating founder growth as inconsistency wastes time defending old priorities instead of using the clearer product judgment.',
    alternativePath: 'Keep the protected foundation stable, then use the sharper founder taste to judge Phase 2 Explain evidence.',
    ctoBias: 'favor founder evolution as signal, not noise',
    confidence: 82
  },
  vision_alignment: {
    firstOrderConsequence: 'Continuing the current path improves operating discipline, but may not prove the user-facing breakthrough.',
    secondOrderConsequence: 'If the system keeps optimizing infrastructure, founder trust can drop because progress feels busy but not closer to the dream.',
    opportunityCost: 'Every day spent on agent plumbing is a day not spent proving the Explain wedge or action surface.',
    alternativePath: 'Keep the governance rails stable and redirect effort toward one evidence-backed Explain moment.',
    ctoBias: 'favor product proof over more infrastructure',
    confidence: 86
  },
  phase2_explain: {
    firstOrderConsequence: 'A bounded Explain flow can create visible user leverage without changing the protected keyboard foundation.',
    secondOrderConsequence: 'If Explain works, Aritenis starts competing on understanding-before-typing instead of Gboard-style keyboard basics.',
    opportunityCost: 'Building broad companion behavior now would delay the smallest proof that users actually need.',
    alternativePath: 'Ship the narrowest screenshot-to-explanation proposal with confirm/cancel and no auto-send.',
    ctoBias: 'favor narrow Explain proof',
    confidence: 84
  },
  execution_risk: {
    firstOrderConsequence: 'A change can create real progress, but it can also damage typing trust if it touches protected runtime paths.',
    secondOrderConsequence: 'A bad change in prediction, swipe, or latency would reduce confidence in Phase 2 before the differentiator is proven.',
    opportunityCost: 'Chasing a risky patch consumes validation time that could be used for safer product evidence.',
    alternativePath: 'Use a review-only plan or sandbox experiment unless the evidence clearly justifies mutation.',
    ctoBias: 'favor minimum necessary change',
    confidence: 85
  },
  progress_reality: {
    firstOrderConsequence: 'A grounded status answer restores trust better than a fake health or momentum number.',
    secondOrderConsequence: 'If progress reporting becomes noisy, the founder will ignore the agents even when something important happens.',
    opportunityCost: 'Every low-signal update spends attention that should be reserved for real blockers or decisions.',
    alternativePath: 'Report only verified changes, active blockers, and founder-relevant next decisions.',
    ctoBias: 'favor evidence over status theater',
    confidence: 87
  },
  agent_intelligence: {
    firstOrderConsequence: 'Answering the real question improves trust more than repeating founder memory.',
    secondOrderConsequence: 'If agents keep routing by keywords, they cannot be trusted during founder absence.',
    opportunityCost: 'More memory files will not help if objective reconstruction stays weak.',
    alternativePath: 'Use founder objective reconstruction first, then answer directly, then cite uncertainty.',
    ctoBias: 'favor reasoning over retrieval',
    confidence: 83
  },
  default: {
    firstOrderConsequence: 'A direct answer may satisfy the immediate question, but strategic context prevents shallow replies.',
    secondOrderConsequence: 'Repeated shallow answers make the agent feel like a search box instead of a CTO.',
    opportunityCost: 'Over-answering with templates can hide the actual decision the founder is trying to make.',
    alternativePath: 'Answer the founder objective first, then add only the strategic tradeoff that changes the decision.',
    ctoBias: 'favor concise strategic judgment',
    confidence: 76
  }
};

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

module.exports = {
  buildStrategicThinking,
  formatStrategicThinking,
  responseUsesStrategicThinking
};
