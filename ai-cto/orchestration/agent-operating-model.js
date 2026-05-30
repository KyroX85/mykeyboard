const AGENTS = [
  {
    id: 'cto',
    name: 'CTO',
    authority: 'final product/technical recommendation',
    owns: ['roadmap coherence', 'tradeoff calls', 'founder-ready summaries'],
    cannotDo: ['bypass approval', 'mutate protected foundation from conversation']
  },
  {
    id: 'foundation_guardian',
    name: 'Foundation Guardian',
    authority: 'blocks trust regressions',
    owns: ['typing trust', 'swipe trust', 'prediction trust', 'latency', 'stability'],
    cannotDo: ['approve foundation churn without evidence']
  },
  {
    id: 'roadmap_agent',
    name: 'Roadmap Agent',
    authority: 'classifies work into FOUNDATION, EXECUTION, COMPANION, EXPERIMENT, BLOAT',
    owns: ['Phase 2 Explain priority', 'anti-bloat filtering', 'roadmap drift detection'],
    cannotDo: ['treat old Phase 1 stabilization as active roadmap']
  },
  {
    id: 'product_judgment',
    name: 'Product Judgment Agent',
    authority: 'scores user pain, frequency, leverage, companion alignment, and trust risk',
    owns: ['proposal quality', 'user leverage', 'why Aritenis over Gboard'],
    cannotDo: ['claim value without user pain']
  },
  {
    id: 'explain_architect',
    name: 'Explain Architect',
    authority: 'designs Explain workflows',
    owns: ['screenshot understanding', 'Explain action surface', 'ready/confirm/cancel output'],
    cannotDo: ['auto-send replies', 'store screenshots forever']
  },
  {
    id: 'privacy_guardian',
    name: 'Privacy Guardian',
    authority: 'blocks creepy or unsafe context handling',
    owns: ['screenshot retention', 'explicit user trigger', 'no silent reading'],
    cannotDo: ['permit hidden collection']
  },
  {
    id: 'execution_operator',
    name: 'Execution Operator',
    authority: 'implements only approved bounded changes',
    owns: ['patch preparation', 'tests', 'rollback notes'],
    cannotDo: ['execute from vague conversation']
  },
  {
    id: 'product_lab',
    name: 'Product Lab',
    authority: 'collects visual and workflow evidence',
    owns: ['GitHub emulator runs', 'screenshots', 'artifact reports'],
    cannotDo: ['judge product value alone']
  }
];

function getAgentRoster() {
  return AGENTS.map((agent) => ({ ...agent }));
}

function formatAgentBoard({ decisions = [] } = {}) {
  const lines = [
    'Aritenis Agent Board',
    'Mode: Phase 2 preparation with Phase 1 foundation protected.',
    ''
  ];
  for (const agent of AGENTS) {
    lines.push(`${agent.name}: owns ${agent.owns.join(', ')}.`);
  }
  if (decisions.length) {
    lines.push('', 'Recent Decisions:');
    for (const decision of decisions.slice(0, 5)) {
      lines.push(`- ${decision}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  getAgentRoster,
  formatAgentBoard
};
