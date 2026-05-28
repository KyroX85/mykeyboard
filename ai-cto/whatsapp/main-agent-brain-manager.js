const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENT_BRAIN_DIR = process.env.ARITENIS_AGENT_BRAIN_DIR
  ? path.resolve(process.env.ARITENIS_AGENT_BRAIN_DIR)
  : path.join(ROOT, 'ai-cto', 'agent-brains');
const CORE_AGENTS = ['cto', 'coder', 'reviewer', 'auditor'];

const AGENT_PROFILES = {
  cto: {
    name: 'Aritenis CTO',
    role: 'Coordinator',
    reportsTo: 'Founder',
    responsibility: 'Owns roadmap priority, work assignment, approval boundaries, and momentum.'
  },
  coder: {
    name: 'Aritenis Coder',
    role: 'Implementation Worker',
    reportsTo: 'CTO',
    responsibility: 'Tracks implementation attempts, safe fixes, blocked coding work, and next patch steps.'
  },
  reviewer: {
    name: 'Aritenis Reviewer',
    role: 'Regression Gate',
    reportsTo: 'CTO',
    responsibility: 'Tracks validation risk, regression concerns, and merge safety.'
  },
  auditor: {
    name: 'Aritenis Auditor',
    role: 'Safety Gate',
    reportsTo: 'CTO',
    responsibility: 'Tracks dangerous scope, secrets, unsafe automation, and fake progress risk.'
  }
};

const SHARED_DIRECTION = {
  directionId: 'aritenis-roadmap-2026-2027',
  ctoOwnsPriority: true,
  rule: 'Separate working memory, one shared CTO-controlled direction.',
  roadmapFile: 'ai-cto/AGENT_ROADMAP.md',
  visionFile: 'ai-cto/VISION_NORTH_STAR.md',
  sharedStateFiles: [
    'ai-cto/.brain_state.json',
    'ai-cto/tasks.json',
    'ai-cto/goals.json',
    'ai-cto/execution-log.json',
    'ai-cto/agent-action-log.json'
  ],
  forbiddenDrift: [
    'No agent starts independent priorities outside CTO direction.',
    'No agent claims progress not grounded in repo state.',
    'No agent executes risky work without approval boundaries.'
  ]
};

function ensureCoreAgentBrains() {
  try {
    fs.mkdirSync(AGENT_BRAIN_DIR, { recursive: true });
  } catch {
    return CORE_AGENTS.reduce((created, agent) => {
      created[agent] = relativeBrainPath(agent);
      return created;
    }, {});
  }
  return CORE_AGENTS.reduce((created, agent) => {
    const brain = readCoreAgentBrain(agent) || defaultBrain(agent);
    const next = normalizeBrain(agent, brain);
    writeBrain(agent, next);
    created[agent] = relativeBrainPath(agent);
    return created;
  }, {});
}

function readCoreAgentBrain(agent) {
  const safeAgent = normalizeAgent(agent);
  const file = brainPath(safeAgent);
  try {
    if (!fs.existsSync(file)) return null;
    return normalizeBrain(safeAgent, JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return normalizeBrain(safeAgent, defaultBrain(safeAgent, 'Recovered from corrupt brain file.'));
  }
}

function recordCoreAgentInteraction({ agent, intent, topic, action, outcome, riskLevel }) {
  const safeAgent = normalizeAgent(agent);
  const brain = readCoreAgentBrain(safeAgent) || defaultBrain(safeAgent);
  const interaction = {
    at: new Date().toISOString(),
    agent: safeAgent,
    intent: compact(intent || 'update', 50),
    topic: compact(topic || brain.memory.activeTask || 'general status', 90),
    action: compact(action || 'prepared grounded WhatsApp response', 120),
    outcome: compact(outcome || 'response sent', 120),
    riskLevel: compact(riskLevel || 'LOW', 20)
  };

  const recent = Array.isArray(brain.memory.recentInteractions)
    ? brain.memory.recentInteractions
    : [];
  const next = normalizeBrain(safeAgent, {
    ...brain,
    memory: {
      ...brain.memory,
      activeTask: interaction.topic,
      lastInteraction: interaction,
      recentInteractions: [interaction, ...recent].slice(0, 20)
    },
    updatedAt: interaction.at
  });
  writeBrain(safeAgent, next);
  return next;
}

function defaultBrain(agent, recoveryNote = null) {
  const profile = AGENT_PROFILES[agent] || AGENT_PROFILES.cto;
  return {
    version: '1.0',
    agentId: agent,
    name: profile.name,
    role: profile.role,
    reportsTo: profile.reportsTo,
    responsibility: profile.responsibility,
    sharedDirection: SHARED_DIRECTION,
    memory: {
      activeTask: 'roadmap-aligned monitoring',
      lastInteraction: null,
      recentInteractions: [],
      blockedReason: null,
      missedIssues: [],
      confidence: 'not fully verified yet',
      nextMove: 'read shared state, follow CTO priority, report grounded findings',
      recoveryNote
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeBrain(agent, brain) {
  const profile = AGENT_PROFILES[agent] || AGENT_PROFILES.cto;
  return {
    version: '1.0',
    ...brain,
    agentId: agent,
    name: profile.name,
    role: profile.role,
    reportsTo: profile.reportsTo,
    responsibility: profile.responsibility,
    sharedDirection: SHARED_DIRECTION,
    memory: {
      activeTask: 'roadmap-aligned monitoring',
      lastInteraction: null,
      recentInteractions: [],
      blockedReason: null,
      missedIssues: [],
      confidence: 'not fully verified yet',
      nextMove: 'read shared state, follow CTO priority, report grounded findings',
      ...(brain && brain.memory ? brain.memory : {})
    },
    updatedAt: brain.updatedAt || new Date().toISOString()
  };
}

function writeBrain(agent, brain) {
  try {
    fs.mkdirSync(AGENT_BRAIN_DIR, { recursive: true });
    fs.writeFileSync(brainPath(agent), JSON.stringify(brain, null, 2));
  } catch {
    // Brain persistence must not break WhatsApp routing.
  }
}

function brainPath(agent) {
  return path.join(AGENT_BRAIN_DIR, `${normalizeAgent(agent)}.json`);
}

function relativeBrainPath(agent) {
  return path.relative(ROOT, brainPath(agent)).replace(/\\/g, '/');
}

function normalizeAgent(agent) {
  return CORE_AGENTS.includes(agent) ? agent : 'cto';
}

function compact(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  AGENT_BRAIN_DIR,
  CORE_AGENTS,
  SHARED_DIRECTION,
  ensureCoreAgentBrains,
  readCoreAgentBrain,
  recordCoreAgentInteraction
};
