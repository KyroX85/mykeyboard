const { judgeProposal } = require('./advanced-product-judgment-engine');
const { buildEvidenceContext, formatEvidenceContext } = require('./evidence-context-engine');

function buildAgentCouncil(proposal = '') {
  const judgment = judgeProposal(proposal);
  const evidence = buildEvidenceContext(proposal);
  const votes = buildVotes(judgment, evidence);
  const decision = councilDecision(judgment, evidence, votes);

  return {
    proposal: String(proposal || '').trim(),
    roadmap: {
      classification: judgment.classification,
      reason: judgment.roadmapReason
    },
    judgment,
    evidence,
    votes,
    decision,
    safeNextStep: safeNextStepFor(decision, judgment, evidence)
  };
}

function buildVotes(judgment, evidence) {
  return [
    roadmapVote(judgment),
    foundationVote(judgment, evidence),
    productVote(judgment),
    explainVote(judgment),
    privacyVote(judgment),
    executionVote(judgment, evidence)
  ];
}

function roadmapVote(judgment) {
  if (judgment.classification === 'BLOAT') {
    return vote('Roadmap Agent', 'BLOCK', 'Not aligned with Phase 2 Explain or protected foundation.');
  }
  if (judgment.classification === 'FOUNDATION') {
    return vote('Roadmap Agent', 'REQUIRE_EVIDENCE', 'Foundation work is guarded and needs regression proof.');
  }
  return vote('Roadmap Agent', 'SUPPORT', 'Aligned with current Phase 2 Explain direction.');
}

function foundationVote(judgment, evidence) {
  if (judgment.classification === 'FOUNDATION') {
    return vote('Foundation Guardian', 'REQUIRE_EVIDENCE', 'Do not touch keyboard trust systems without concrete regression evidence.');
  }
  if (judgment.trustRisk === 'HIGH' || judgment.trustRisk === 'CRITICAL') {
    return vote('Foundation Guardian', 'REVIEW', 'Trust risk is elevated; keep changes outside typing hot path.');
  }
  return vote('Foundation Guardian', 'SUPPORT', `No direct foundation mutation required. Evidence confidence: ${evidence.confidence}.`);
}

function productVote(judgment) {
  if (judgment.leverageScore >= 70) {
    return vote('Product Judgment Agent', 'SUPPORT', 'User leverage is strong enough for design-level work.');
  }
  if (judgment.decision === 'CLARIFY_USER_PAIN') {
    return vote('Product Judgment Agent', 'CLARIFY', 'User pain is still too broad.');
  }
  return vote('Product Judgment Agent', 'REVIEW', 'Value exists but needs sharper proof.');
}

function explainVote(judgment) {
  if (judgment.companionAlignment === 'STRONG') {
    return vote('Explain Architect', 'SUPPORT', 'Supports understanding-before-typing without requiring auto-send.');
  }
  return vote('Explain Architect', 'REVIEW', 'Not clearly part of the Explain wedge.');
}

function privacyVote(judgment) {
  const text = judgment.proposal.toLowerCase();
  if (/\b(auto.?send|forever|silent|background|upload|cloud)\b/.test(text)) {
    return vote('Privacy Guardian', 'BLOCK', 'Unsafe context handling or retention risk.');
  }
  if (/\b(screenshot|message|document|chat)\b/.test(text)) {
    return vote('Privacy Guardian', 'REVIEW', 'Requires explicit trigger, temporary handling, and confirm/cancel.');
  }
  return vote('Privacy Guardian', 'SUPPORT', 'No obvious private content expansion.');
}

function executionVote(judgment, evidence) {
  if (judgment.decision === 'APPROVE_DESIGN_ONLY') {
    return vote('Execution Operator', 'SUPPORT', 'Design/proposal work is safe; implementation still needs explicit approval.');
  }
  if (evidence.missing.length) {
    return vote('Execution Operator', 'REVIEW', 'Evidence gaps should be resolved before patching.');
  }
  return vote('Execution Operator', 'REVIEW', 'No execution should start from council review alone.');
}

function councilDecision(judgment, evidence, votes) {
  if (votes.some((item) => item.position === 'BLOCK')) return 'BLOCK_TRUST_RISK';
  if (judgment.decision === 'REQUIRE_FOUNDATION_EVIDENCE') return 'REQUIRE_FOUNDATION_EVIDENCE';
  if (judgment.decision === 'REJECT_BLOAT') return 'REJECT_BLOAT';
  if (judgment.decision === 'CLARIFY_USER_PAIN') return 'CLARIFY_USER_PAIN';
  if (judgment.decision === 'APPROVE_DESIGN_ONLY') return 'APPROVE_DESIGN_ONLY';
  if (evidence.confidence === 'LOW') return 'LOW_CONFIDENCE_REVIEW_REQUIRED';
  return 'REVIEW_BEFORE_EXECUTION';
}

function safeNextStepFor(decision, judgment, evidence) {
  if (decision === 'APPROVE_DESIGN_ONLY') {
    return 'Design Explain flow only, with ready/confirm/cancel and no automatic sending.';
  }
  if (decision === 'BLOCK_TRUST_RISK') {
    return 'Redesign around explicit trigger, temporary context, and confirm/cancel before any execution.';
  }
  if (decision === 'REQUIRE_FOUNDATION_EVIDENCE') {
    return 'Do not touch foundation. Bring regression evidence, affected devices, and rollback criteria first.';
  }
  if (decision === 'REJECT_BLOAT') {
    return 'Reject as bloat unless it directly improves Explain completion or protected foundation health.';
  }
  if (decision === 'CLARIFY_USER_PAIN') {
    return 'Clarify user pain, frequency, and why current keyboards cannot solve it.';
  }
  if (evidence.missing.length) {
    return `Collect missing evidence first: ${evidence.missing.join(', ')}.`;
  }
  return 'Prepare a bounded proposal only; wait for explicit founder approval before implementation.';
}

function vote(agent, position, reason) {
  return { agent, position, reason };
}

function formatAgentCouncil(council) {
  const votes = council.votes
    .map((item) => `- ${item.agent}: ${item.position} - ${item.reason}`)
    .join('\n');
  return [
    'Agent Council',
    `Proposal: ${council.proposal}`,
    `Classification: ${council.roadmap.classification}`,
    `Decision: ${council.decision}`,
    '',
    formatEvidenceContext(council.evidence),
    '',
    'Council Votes',
    votes,
    '',
    `Safe Next Step: ${council.safeNextStep}`
  ].join('\n');
}

module.exports = {
  buildAgentCouncil,
  formatAgentCouncil
};
