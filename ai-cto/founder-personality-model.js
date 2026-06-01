const FOUNDER_PERSONALITY_MODEL = {
  observedCommunication: [
    'direct, urgent, and informal when trust is low',
    'repeats failures until the system proves the behavior changed',
    'tests agents through short ambiguous questions rather than formal specs',
    'reacts badly when agents answer with templates instead of understanding intent'
  ],
  rejects: [
    'bureaucracy',
    'fake progress',
    'architecture theatre',
    'menu loops for normal conversation',
    'status blocks without evidence',
    'complexity that does not move the product toward leverage'
  ],
  repeats: [
    'agents must understand the founder vision',
    'agents must push to GitHub after changes',
    'Phase 2 must create leverage beyond Gboard',
    'conversation must feel intelligent, not rule based',
    'no fake sophistication or AGI claims'
  ],
  obsessesOver: [
    'company dream',
    'user leverage',
    'real product evidence',
    'trust and privacy',
    'simple founder-facing interfaces',
    'agents working while founder is absent'
  ],
  preferences: [
    'high leverage over more systems',
    'product reality over architecture explanation',
    'small clear interfaces over workflows and menus',
    'evidence-backed judgment over generated confidence',
    'direct answers before formatting'
  ]
};

function predictFounderReaction({
  proposal = '',
  evidence = '',
  interfaceShape = '',
  expectedUserOutcome = ''
} = {}) {
  const text = `${proposal} ${evidence} ${interfaceShape} ${expectedUserOutcome}`.toLowerCase();
  const likelyRejections = [];
  const likelyApprovals = [];

  if (/\b(report|summary|briefing|audit|dashboard)\b/.test(text) && !hasUserOutcome(text)) {
    likelyRejections.push('looks like fake progress instead of user value');
  }
  if (/\barchitecture|framework|orchestration|multi-agent|scalable|refactor|modernize\b/.test(text) && !hasUserOutcome(text)) {
    likelyRejections.push('smells like architecture theatre');
  }
  if (/\boptions:|choose|menu|approval flow|gate\b/.test(text) && /\bconversation|question|discuss\b/.test(text)) {
    likelyRejections.push('adds bureaucracy to normal conversation');
  }
  if (/\bhealth|momentum|score|status\b/.test(text) && !/\bsource|evidence|calculation|failed|passed\b/.test(text)) {
    likelyRejections.push('status claim lacks evidence');
  }
  if (/\bauto-send|silent|raw typing|raw screenshot|forever|telemetry\b/.test(text)) {
    likelyRejections.push('violates trust or privacy boundary');
  }

  if (/\bexplain|screenshot|understand|confusing|action surface\b/.test(text)) {
    likelyApprovals.push('moves toward Phase 2 leverage');
  }
  if (/\buser|retention|trust|privacy|typing flow|gboard|daily workflow\b/.test(text)) {
    likelyApprovals.push('connects to product reality');
  }
  if (/\bsimple|small|one tap|one[- ]?handed|clear|confirm|cancel|ready\b/.test(text)) {
    likelyApprovals.push('keeps interface simple');
  }
  if (/\bevidence|screenshot|test|verified|failed|passed|artifact\b/.test(text)) {
    likelyApprovals.push('uses reality before claiming progress');
  }

  const verdict = likelyRejections.length
    ? 'LIKELY_REJECT'
    : likelyApprovals.length >= 2
      ? 'LIKELY_ACCEPT'
      : 'UNCERTAIN';

  return {
    verdict,
    likelyRejections,
    likelyApprovals,
    confidence: verdict === 'UNCERTAIN' ? 62 : Math.min(88, 70 + (Math.max(likelyRejections.length, likelyApprovals.length) * 6)),
    guidance: guidanceFor(verdict, likelyRejections, likelyApprovals)
  };
}

function formatFounderReactionPrediction(prediction = {}) {
  return [
    'Founder reaction prediction:',
    `- Verdict: ${prediction.verdict || 'UNCERTAIN'}`,
    `- Likely rejection: ${prediction.likelyRejections && prediction.likelyRejections.length ? prediction.likelyRejections[0] : 'none obvious'}`,
    `- Likely approval: ${prediction.likelyApprovals && prediction.likelyApprovals.length ? prediction.likelyApprovals[0] : 'not proven yet'}`,
    `- Guidance: ${prediction.guidance || 'Sharpen user outcome and evidence before proposing.'}`
  ].join('\n');
}

function hasUserOutcome(text = '') {
  return /\b(user|retention|trust|understand|reply|act|typing flow|workflow|gboard|daily)\b/.test(text);
}

function guidanceFor(verdict, rejections, approvals) {
  if (verdict === 'LIKELY_REJECT') {
    return `Reframe before proposing: ${rejections[0]}.`;
  }
  if (verdict === 'LIKELY_ACCEPT') {
    return `Proceed as proposal only: ${approvals[0]}.`;
  }
  return 'Founder reaction is uncertain; add evidence, user outcome, and a simpler interface shape.';
}

module.exports = {
  FOUNDER_PERSONALITY_MODEL,
  predictFounderReaction,
  formatFounderReactionPrediction
};
