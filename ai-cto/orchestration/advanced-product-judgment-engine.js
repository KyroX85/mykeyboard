const { classifyRoadmapWork } = require('./phase2-roadmap-brain');

function judgeProposal(proposal = '') {
  const text = String(proposal || '').trim();
  const lower = text.toLowerCase();
  const roadmap = classifyRoadmapWork(text);
  const userPain = inferUserPain(lower);
  const frequency = inferFrequency(lower);
  const leverageScore = scoreLeverage({ lower, roadmap, userPain, frequency });
  const trustRisk = scoreTrustRisk(lower, roadmap);
  const companionAlignment = scoreCompanionAlignment(lower);
  const decision = decide({ roadmap, leverageScore, trustRisk, userPain });

  return {
    proposal: text,
    classification: roadmap.classification,
    roadmapReason: roadmap.reason,
    userPain,
    frequency,
    leverageScore,
    trustRisk,
    companionAlignment,
    decision,
    recommendation: recommendationFor({ decision, roadmap, leverageScore, trustRisk })
  };
}

function inferUserPain(text) {
  if (/\b(explain|understand|confusing|screenshot|bill|notice|form|error|document|post)\b/.test(text)) {
    return 'User sees confusing content and needs understanding before typing.';
  }
  if (/\b(draft|reply|email|message)\b/.test(text)) {
    return 'User needs to turn context into a communication artifact.';
  }
  if (/\b(prediction|predictor|swipe|typing|latency)\b/.test(text)) {
    return 'Foundation quality pain; only valid if evidence shows regression.';
  }
  if (/\b(theme|refactor|architecture|dashboard)\b/.test(text)) {
    return 'Weak or indirect user pain.';
  }
  return 'User pain is not specific enough yet.';
}

function inferFrequency(text) {
  if (/\b(screenshot|message|reply|post|error|bill|notice|form)\b/.test(text)) return 'HIGH';
  if (/\b(document|email|summarize)\b/.test(text)) return 'MEDIUM';
  if (/\b(theme|architecture|refactor)\b/.test(text)) return 'LOW';
  return 'UNKNOWN';
}

function scoreLeverage({ lower, roadmap, userPain, frequency }) {
  let score = 40;
  if (roadmap.classification === 'EXECUTION') score += 25;
  if (roadmap.classification === 'COMPANION') score += 8;
  if (roadmap.classification === 'BLOAT') score -= 25;
  if (roadmap.classification === 'FOUNDATION') score -= 10;
  if (frequency === 'HIGH') score += 15;
  if (/understand|explain|screenshot/.test(lower)) score += 15;
  if (/auto.?send|autonomous|forever|silent/.test(lower)) score -= 30;
  if (userPain === 'Weak or indirect user pain.') score -= 15;
  return clamp(score);
}

function scoreTrustRisk(text, roadmap) {
  let score = 20;
  if (roadmap.classification === 'FOUNDATION') score += 40;
  if (/\b(latency|keyboardservice|prediction|predictor|swipe|typing|layout|sizing)\b/.test(text)) score += 25;
  if (/\b(screenshot|photo|message|chat|document)\b/.test(text)) score += 20;
  if (/\b(auto.?send|silent|background|forever|store|upload|cloud)\b/.test(text)) score += 30;
  if (/\b(confirm|cancel|explicit|temporary|local|approval)\b/.test(text)) score -= 20;
  return riskBand(clamp(score));
}

function scoreCompanionAlignment(text) {
  if (/\b(explain|understand|context|screenshot|draft|reply)\b/.test(text)) return 'STRONG';
  if (/\b(companion|assistant)\b/.test(text)) return 'MEDIUM_UNPROVEN';
  if (/\b(theme|refactor|architecture)\b/.test(text)) return 'WEAK';
  return 'UNKNOWN';
}

function decide({ roadmap, leverageScore, trustRisk, userPain }) {
  if (roadmap.classification === 'BLOAT') return 'REJECT_BLOAT';
  if (roadmap.classification === 'FOUNDATION' && trustRisk !== 'LOW') return 'REQUIRE_FOUNDATION_EVIDENCE';
  if (trustRisk === 'CRITICAL') return 'BLOCK_TRUST_RISK';
  if (userPain === 'User pain is not specific enough yet.') return 'CLARIFY_USER_PAIN';
  if (leverageScore >= 70 && ['LOW', 'MEDIUM'].includes(trustRisk)) return 'APPROVE_DESIGN_ONLY';
  return 'REVIEW_BEFORE_EXECUTION';
}

function recommendationFor({ decision, roadmap, leverageScore, trustRisk }) {
  if (decision === 'APPROVE_DESIGN_ONLY') return 'Proceed with design/proposal only; execution still requires founder approval.';
  if (decision === 'REQUIRE_FOUNDATION_EVIDENCE') return 'Do not execute. Bring regression evidence before touching foundation.';
  if (decision === 'REJECT_BLOAT') return 'Reject. Not enough direct leverage for Phase 2 Explain.';
  if (decision === 'BLOCK_TRUST_RISK') return 'Block until privacy, latency, and confirmation risks are reduced.';
  if (decision === 'CLARIFY_USER_PAIN') return 'Clarify the concrete user pain and daily frequency.';
  return `Review carefully. Classification=${roadmap.classification}, leverage=${leverageScore}, trustRisk=${trustRisk}.`;
}

function formatJudgment(judgment) {
  return [
    `Phase 2 Opportunity: ${judgment.classification}`,
    `User Pain: ${judgment.userPain}`,
    `Frequency: ${judgment.frequency}`,
    `Leverage Score: ${judgment.leverageScore}/100`,
    `Trust Risk: ${judgment.trustRisk}`,
    `Companion Alignment: ${judgment.companionAlignment}`,
    `Recommendation: ${judgment.recommendation}`
  ].join('\n');
}

function riskBand(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

module.exports = {
  judgeProposal,
  formatJudgment
};
