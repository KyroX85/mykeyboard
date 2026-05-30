const { createNvidiaClient } = require('../whatsapp/nvidia-nim-client');
const { buildAgentCouncil, summarizeCouncil } = require('./agent-council-engine');
const { buildEvidenceContext, formatEvidenceContext } = require('./evidence-context-engine');

const COUNCIL_ROLES = [
  {
    id: 'cto',
    modelKind: 'llama',
    title: 'CTO / Roadmap Agent',
    prompt: 'Judge whether this moves Aritenis toward the company vision: protected keyboard foundation plus Phase 2 Explain.'
  },
  {
    id: 'product',
    modelKind: 'llama',
    title: 'Product Judgment Agent',
    prompt: 'Judge user pain, retention value, frequency, leverage, and whether this is worth founder attention.'
  },
  {
    id: 'engineering',
    modelKind: 'deepseek',
    title: 'Engineering Risk Agent',
    prompt: 'Judge implementation risk, likely files, tests needed, rollback plan, and whether coding should wait.'
  },
  {
    id: 'critic',
    modelKind: 'qwenCoder',
    title: 'Critic / Governance Agent',
    prompt: 'Challenge weak assumptions. Focus on privacy, hot-path risk, overbuilding, and hidden execution risk.'
  }
];

async function buildNvidiaCouncil({
  proposal = '',
  root = process.cwd(),
  client = createNvidiaClient(),
  evidence = buildEvidenceContext(proposal),
  fallbackCouncil = buildAgentCouncil(proposal)
} = {}) {
  const availableRoles = COUNCIL_ROLES.filter((role) => client.available(role.modelKind));
  if (availableRoles.length < 2) {
    return fallbackResult({ proposal, fallbackCouncil, reason: 'not enough NVIDIA council models configured' });
  }

  const roundOne = [];
  for (const role of availableRoles) {
    const result = await callCouncilRole({ client, role, proposal, evidence, priorOpinions: [] });
    roundOne.push(result);
  }

  const roundTwo = [];
  for (const role of availableRoles) {
    const result = await callCouncilRole({ client, role, proposal, evidence, priorOpinions: roundOne, challengeRound: true });
    roundTwo.push(result);
  }

  const usable = [...roundOne, ...roundTwo].filter((item) => item.ok && item.content);
  if (usable.length < 2) {
    return fallbackResult({ proposal, fallbackCouncil, reason: 'NVIDIA council did not return enough usable opinions' });
  }

  return {
    mode: 'NVIDIA_MODEL_COUNCIL',
    proposal: String(proposal || '').trim(),
    evidence,
    roundOne,
    roundTwo,
    deterministic: fallbackCouncil,
    summary: synthesizeModelCouncil({ proposal, evidence, opinions: usable, fallbackCouncil })
  };
}

async function callCouncilRole({ client, role, proposal, evidence, priorOpinions = [], challengeRound = false }) {
  const prompt = buildRolePrompt({ role, proposal, evidence, priorOpinions, challengeRound });
  const result = await client.chat(role.modelKind, [{ role: 'user', content: prompt }], {
    reason: challengeRound ? 'NVIDIA council challenge round' : 'NVIDIA council independent round',
    riskLevel: 'LOW',
    maxTokens: 360,
    temperature: 0.1
  });
  return {
    role: role.title,
    modelKind: role.modelKind,
    ok: Boolean(result.ok),
    model: result.model,
    content: result.content || '',
    skipped: Boolean(result.skipped),
    reason: result.reason || result.error || ''
  };
}

function buildRolePrompt({ role, proposal, evidence, priorOpinions = [], challengeRound = false }) {
  return [
    role.prompt,
    '',
    'Rules:',
    '- Do not write code.',
    '- Do not approve autonomous execution.',
    '- Be specific and evidence-based.',
    '- Prefer no-change if risk exceeds evidence.',
    '- Output exactly four short lines: Position, Evidence, Risk, Recommendation.',
    '',
    `Proposal: ${proposal}`,
    '',
    formatEvidenceContext(evidence),
    '',
    challengeRound ? 'Other agent opinions to challenge:' : '',
    ...priorOpinions.map((opinion) => `${opinion.role}: ${compact(opinion.content, 500)}`)
  ].filter(Boolean).join('\n');
}

function synthesizeModelCouncil({ proposal, evidence, opinions, fallbackCouncil }) {
  const text = opinions.map((item) => item.content).join('\n').toLowerCase();
  const blocked = /\b(block|reject|do not execute|unsafe|privacy|auto.?send|forever)\b/.test(text);
  const evidenceWeak = evidence.confidence === 'LOW' || /\bweak evidence|missing evidence|not enough evidence|needs evidence\b/.test(text);
  const deterministicSummary = summarizeCouncil(fallbackCouncil);
  return {
    consensus: blocked
      ? 'Model council found trust or privacy risk; do not execute as written.'
      : evidenceWeak
        ? 'Model council sees possible value, but evidence is too weak for implementation.'
        : deterministicSummary.consensus,
    dissent: extractDissent(opinions) || deterministicSummary.dissent,
    recommendation: fallbackCouncil.safeNextStep,
    approvalNeeded: blocked || fallbackCouncil.decision !== 'APPROVE_DESIGN_ONLY'
      ? 'Yes. Founder approval required before any execution.'
      : 'Only for implementation. Discussion/design can continue.',
    modelCount: opinions.length,
    evidenceConfidence: evidence.confidence,
    proposal: String(proposal || '').trim()
  };
}

function extractDissent(opinions = []) {
  const caution = opinions.find((item) => /\b(risk\s*:|block|reject|privacy|unsafe|weak evidence|missing evidence|hot.path|latency)\b/i.test(item.content));
  if (!caution) return '';
  const line = String(caution.content || '').split(/\r?\n/).find((part) =>
    /\b(risk\s*:|block|reject|privacy|unsafe|weak evidence|missing evidence|hot.path|latency)\b/i.test(part)
  );
  return line ? `${caution.role}: ${compact(line.replace(/^(risk|position|evidence|recommendation)\s*:\s*/i, ''), 180)}` : '';
}

function fallbackResult({ proposal, fallbackCouncil, reason }) {
  return {
    mode: 'DETERMINISTIC_COUNCIL_FALLBACK',
    proposal: String(proposal || '').trim(),
    deterministic: fallbackCouncil,
    summary: {
      ...summarizeCouncil(fallbackCouncil),
      recommendation: fallbackCouncil.safeNextStep,
      fallbackReason: reason,
      modelCount: 0
    }
  };
}

function formatNvidiaCouncil(council) {
  const summary = council.summary;
  const modelLine = council.mode === 'NVIDIA_MODEL_COUNCIL'
    ? `Model council: ${summary.modelCount} NVIDIA opinions across independent + challenge rounds.`
    : `Model council: fallback used - ${summary.fallbackReason}.`;
  return [
    'Founder, model council reviewed this.',
    '',
    `Proposal: ${summary.proposal || council.proposal}`,
    modelLine,
    `Consensus: ${summary.consensus}`,
    `Dissent: ${summary.dissent}`,
    `Recommendation: ${summary.recommendation}`,
    `Approval needed: ${summary.approvalNeeded}`,
    '',
    council.evidence ? formatEvidenceContext(council.evidence) : '',
    '',
    'No execution started.'
  ].filter(Boolean).join('\n');
}

function compact(value = '', max = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  COUNCIL_ROLES,
  buildNvidiaCouncil,
  buildRolePrompt,
  formatNvidiaCouncil,
  synthesizeModelCouncil
};
