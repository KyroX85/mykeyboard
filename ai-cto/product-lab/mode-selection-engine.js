function availableModes() {
  return [
    {
      id: 'conversation',
      name: 'Conversation Mode',
      description: 'discuss product naturally; no execution; no governance spam'
    },
    {
      id: 'thinking',
      name: 'Thinking Mode',
      description: 'roadmap analysis, pressure prioritization, bounded proposals'
    },
    {
      id: 'execution',
      name: 'Execution Mode',
      description: 'approved engineering work through governed mutation path'
    },
    {
      id: 'preservation',
      name: 'Preservation Mode',
      description: 'analysis only; mutation blocked'
    },
    {
      id: 'product_lab',
      name: 'Product Lab Mode',
      description: 'screenshot review, UX comparison, evidence reports'
    }
  ];
}

function selectOperationalMode(message = '') {
  const text = String(message || '').toLowerCase();
  if (/\b(show|list|available)\s+modes\b|^modes$/i.test(text)) return decision('MODE_SELECTION', 'founder requested mode menu');
  if (/\bpreservation mode\b|enter preservation|disable preservation/i.test(text)) return decision('PRESERVATION', 'founder referenced preservation mode');
  if (/\b(compare|screenshot|gboard|swiftkey|visual evidence|product lab)\b/i.test(text)) return decision('PRODUCT_LAB', 'message asks for visual product evidence');
  if (/\b(edit|create|delete|commit|push|rewrite|patch|modify|build apk|install apk|change .*file)\b/i.test(text)) return decision('EXECUTION', 'message asks for mutation or build execution');
  if (/\b(rank|prioritize|recommend|safest|proposal|tradeoff|risk|pressure|what should|would .* safer)\b/i.test(text)) return decision('THINKING', 'message asks for product evaluation or recommendation');
  return decision('CONVERSATION', 'message is product discussion or normal conversation');
}

function formatModeMenu() {
  return [
    'AVAILABLE MODES',
    '',
    '1. Conversation Mode',
    '- discuss product naturally',
    '- no execution',
    '- no governance spam',
    '',
    '2. Thinking Mode',
    '- roadmap analysis',
    '- pressure prioritization',
    '- bounded proposals',
    '',
    '3. Execution Mode',
    '- approved engineering work',
    '- governed mutation path',
    '',
    '4. Preservation Mode',
    '- analysis only',
    '- mutation blocked',
    '',
    '5. Product Lab Mode',
    '- screenshot review',
    '- UX comparison',
    '- evidence reports'
  ].join('\n');
}

function decision(mode, reason) {
  return { mode, reason };
}

module.exports = {
  availableModes,
  selectOperationalMode,
  formatModeMenu
};
