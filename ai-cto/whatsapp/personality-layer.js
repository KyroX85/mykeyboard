const AGENTS = {
  cto: {
    label: 'CTO',
    style: 'orchestration',
    responsibilities: ['summaries', 'priorities', 'approvals', 'momentum'],
    greeting: 'Sir, CTO update',
    disclaimer: 'I am reporting current system state only.'
  },
  coder: {
    label: 'Coder',
    style: 'implementation',
    responsibilities: ['files touched', 'implementation progress', 'next coding steps'],
    greeting: 'Sir, Coder side update',
    disclaimer: 'No fake work claim. I can only report recorded changes.'
  },
  reviewer: {
    label: 'Reviewer',
    style: 'regression review',
    responsibilities: ['regression risks', 'validation concerns', 'architecture consistency'],
    greeting: 'Sir, Reviewer note',
    disclaimer: 'Validation status comes from latest recorded CTO run.'
  },
  auditor: {
    label: 'Auditor',
    style: 'safety audit',
    responsibilities: ['secrets', 'oversized files', 'dangerous code', 'stale systems'],
    greeting: 'Sir, Auditor check',
    disclaimer: 'I will flag only evidence present in repo memory/report.'
  }
};

function applyPersonality(agent, lines) {
  const profile = AGENTS[agent] || AGENTS.cto;
  return [
    profile.greeting,
    ...lines.filter(Boolean),
    '',
    `Mode: ${profile.label} / ${profile.style}`
  ].join('\n');
}

function clarificationResponse() {
  return [
    'Sir, which worker should answer?',
    'Try: CTO summary, coder progress, reviewer risks, auditor dangerous issues.'
  ].join('\n');
}

module.exports = {
  AGENTS,
  applyPersonality,
  clarificationResponse
};
