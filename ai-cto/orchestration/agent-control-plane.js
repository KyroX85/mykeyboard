const { formatAgentBoard, getAgentRoster } = require('./agent-operating-model');
const { formatRoadmapBrief, ROADMAP } = require('./phase2-roadmap-brain');
const { formatJudgment, judgeProposal } = require('./advanced-product-judgment-engine');

function buildControlPlaneSnapshot() {
  return {
    mode: 'PAPERCLIP_INSPIRED_ARITENIS_CONTROL_PLANE',
    activePhase: ROADMAP.activePhase,
    northStar: ROADMAP.northStar,
    agents: getAgentRoster(),
    operatingRules: [
      'conversation is not execution',
      'Phase 1 foundation is protected',
      'Explain is the active Phase 2 wedge',
      'no automatic sending',
      'no foundation mutation without evidence',
      'approval before execution'
    ]
  };
}

function formatControlPlaneStatus() {
  const snapshot = buildControlPlaneSnapshot();
  return [
    'Aritenis Control Plane',
    `Mode: ${snapshot.mode}`,
    `Active Phase: ${snapshot.activePhase}`,
    `North Star: ${snapshot.northStar}`,
    '',
    formatRoadmapBrief(),
    '',
    `Agents Online: ${snapshot.agents.length}`,
    'Execution Authority: proposals only unless founder explicitly says implement/execute/commit.'
  ].join('\n');
}

function routeControlPlaneCommand(message = '') {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();

  if (/^(agent board|agents board|roadmap agents|orchestration status|control plane|agent control plane)$/.test(lower)) {
    return {
      command: 'agent_control_plane_status',
      matchedRoute: 'agent_control_plane',
      response: formatControlPlaneStatus()
    };
  }

  if (/^(agent roster|show agents|who are the agents)$/.test(lower)) {
    return {
      command: 'agent_roster',
      matchedRoute: 'agent_control_plane',
      response: formatAgentBoard()
    };
  }

  const proposal = extractProposal(text);
  if (proposal) {
    return {
      command: 'advanced_product_judgment',
      matchedRoute: 'agent_control_plane',
      details: { judgment: judgeProposal(proposal) },
      response: formatJudgment(judgeProposal(proposal))
    };
  }

  return null;
}

function extractProposal(text = '') {
  const match = String(text || '').match(/^(?:judge|evaluate|score|review)\s+(?:proposal|idea|task)?\s*:?\s*(.+)$/i);
  return match ? match[1].trim() : '';
}

module.exports = {
  buildControlPlaneSnapshot,
  formatControlPlaneStatus,
  routeControlPlaneCommand
};
