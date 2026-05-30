const { formatAgentBoard, getAgentRoster } = require('./agent-operating-model');
const { formatRoadmapBrief, ROADMAP } = require('./phase2-roadmap-brain');
const { formatJudgment, judgeProposal } = require('./advanced-product-judgment-engine');
const { buildAgentCouncil, formatAgentCouncil } = require('./agent-council-engine');
const { assessWeakWork, formatWeakWork } = require('./weak-work-filter');

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

  const councilProposal = extractCouncilProposal(text);
  if (councilProposal) {
    const weak = assessWeakWork(councilProposal);
    if (weak.isWeak) {
      return {
        command: 'weak_work_review',
        matchedRoute: 'agent_control_plane',
        details: { weak },
        response: formatWeakWork(weak)
      };
    }
    const council = buildAgentCouncil(councilProposal);
    return {
      command: 'agent_council',
      matchedRoute: 'agent_control_plane',
      details: { council },
      response: formatAgentCouncil(council)
    };
  }

  const proposal = extractProposal(text);
  if (proposal) {
    const weak = assessWeakWork(proposal);
    if (weak.isWeak) {
      return {
        command: 'weak_work_review',
        matchedRoute: 'agent_control_plane',
        details: { weak },
        response: formatWeakWork(weak)
      };
    }
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

function extractCouncilProposal(text = '') {
  const match = String(text || '').match(/^(?:agent council|council|deep judge|what should agents think about this)\s*:?\s*(.+)$/i);
  return match ? match[1].trim() : '';
}

module.exports = {
  buildControlPlaneSnapshot,
  formatControlPlaneStatus,
  routeControlPlaneCommand
};
