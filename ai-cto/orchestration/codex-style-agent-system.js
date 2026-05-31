const fs = require('fs');
const path = require('path');

const DEFAULT_MEMORY_FILES = [
  'ai-cto/roadmap-lock.json',
  'ai-cto/phase2-daily-agent-plan.json',
  'ai-cto/product-operational-memory.json',
  'ai-cto/product-regression-memory.json',
  'ai-cto/founder-memory.json',
  'ai-cto/VISION_NORTH_STAR.md',
  'ai-cto/CONTROLLED_EXECUTION.md'
];

const FUTURE_PHONE_CAPABILITIES = [
  {
    id: 'android_accessibility_service',
    label: 'Android Accessibility Service',
    status: 'FUTURE_GATED',
    allowed: ['observe UI tree after explicit user enablement', 'perform approved app-control actions'],
    forbidden: ['silent control', 'password entry', 'banking/payment actions without explicit approval']
  },
  {
    id: 'notification_access',
    label: 'Notification Access',
    status: 'FUTURE_GATED',
    allowed: ['summarize approved notification context'],
    forbidden: ['store private message bodies by default', 'auto-reply without confirmation']
  },
  {
    id: 'file_access',
    label: 'File Access',
    status: 'FUTURE_GATED',
    allowed: ['read founder-approved project files', 'write approved patches'],
    forbidden: ['bulk upload personal files', 'modify protected runtime files without approval']
  },
  {
    id: 'app_control',
    label: 'App Control',
    status: 'FUTURE_GATED',
    allowed: ['open approved apps', 'prepare actions for confirmation'],
    forbidden: ['send messages automatically', 'purchase, delete, or publish without approval']
  }
];

class MemoryLayer {
  constructor({ root = process.cwd(), memoryFiles = DEFAULT_MEMORY_FILES } = {}) {
    this.root = root;
    this.memoryFiles = memoryFiles;
  }

  retrieveRelevantMemories(goal = '', limit = 5) {
    const tokens = tokenize(goal);
    return this.memoryFiles
      .map((relativePath) => this.readMemory(relativePath))
      .filter((memory) => memory.exists)
      .map((memory) => ({
        ...memory,
        relevance: scoreRelevance(memory.text, tokens)
      }))
      .sort((a, b) => b.relevance - a.relevance || a.relativePath.localeCompare(b.relativePath))
      .slice(0, limit);
  }

  readMemory(relativePath) {
    const fullPath = path.join(this.root, relativePath);
    try {
      const text = fs.readFileSync(fullPath, 'utf8');
      return {
        relativePath,
        fullPath,
        exists: true,
        text: text.slice(0, 4000),
        kind: path.extname(relativePath).replace('.', '') || 'text'
      };
    } catch {
      return {
        relativePath,
        fullPath,
        exists: false,
        text: '',
        kind: 'missing'
      };
    }
  }

  snapshot(goal = '') {
    const memories = this.retrieveRelevantMemories(goal);
    return {
      retrievedAt: new Date().toISOString(),
      memoryCount: memories.length,
      memories: memories.map((memory) => ({
        relativePath: memory.relativePath,
        kind: memory.kind,
        relevance: memory.relevance,
        preview: compact(memory.text, 240)
      }))
    };
  }
}

class ChiefAgent {
  understand(goal = '', memories = []) {
    const objective = String(goal || '').trim();
    return {
      agent: 'Chief Agent',
      objective,
      mode: classifyObjective(objective),
      constraints: inferConstraints(objective, memories),
      successCriteria: inferSuccessCriteria(objective),
      delegationIntent: 'Delegate planning to Planner Agent. Do not execute directly.'
    };
  }
}

class PlannerAgent {
  createPlan({ chiefBrief, memorySnapshot, previousFailure = null } = {}) {
    const objective = chiefBrief.objective;
    const tasks = [
      task('T1', 'memory_context_check', 'READ_MEMORY', 'Retrieve relevant project state before planning.', []),
      task('T2', 'objective_decomposition', 'ANALYZE_OBJECTIVE', 'Break founder objective into bounded work units.', ['T1']),
      task('T3', 'capability_boundary_check', 'CAPABILITY_CHECK', 'Check Android/phone/file/app-control capability gates.', ['T2']),
      task('T4', 'execution_proposal', 'PROPOSE_NEXT_STEP', 'Produce the safest next action without autonomous mutation.', ['T3']),
      task('T5', 'approval_gate', 'AWAIT_APPROVAL_GATE', 'Wait for founder approval before file/app/runtime actions.', ['T4'])
    ];
    if (previousFailure) {
      tasks.splice(2, 0, task('T2R', 'failure_replan', 'REPLAN_FROM_FAILURE', previousFailure.reason, ['T2']));
    }
    return {
      agent: 'Planner Agent',
      objective,
      predictedFailures: predictFailures(objective, chiefBrief),
      taskGraph: {
        nodes: tasks,
        edges: tasks.flatMap((item) => item.dependsOn.map((from) => ({ from, to: item.id })))
      },
      rule: 'Planner never executes. It returns a task graph only.'
    };
  }
}

class ExecutorAgent {
  executeOne(taskNode, context = {}) {
    const startedAt = new Date().toISOString();
    const log = [`Executor received one task: ${taskNode.id} ${taskNode.name}`];
    let status = 'PASS';
    let artifact = {};

    if (taskNode.operation === 'READ_MEMORY') {
      artifact = { memorySnapshot: context.memorySnapshot || { memoryCount: 0, memories: [] } };
      log.push(`Retrieved memories: ${artifact.memorySnapshot.memoryCount || 0}`);
    } else if (taskNode.operation === 'ANALYZE_OBJECTIVE') {
      artifact = { decomposition: decomposeObjective(context.objective || '') };
      log.push(`Decomposed work units: ${artifact.decomposition.length}`);
    } else if (taskNode.operation === 'CAPABILITY_CHECK') {
      artifact = { capabilities: FUTURE_PHONE_CAPABILITIES };
      log.push('Phone capability gates enumerated; no phone control enabled.');
    } else if (taskNode.operation === 'PROPOSE_NEXT_STEP') {
      artifact = { proposal: proposeNextStep(context.objective || '', context.chiefBrief) };
      log.push(`Proposal classification: ${artifact.proposal.classification}`);
    } else if (taskNode.operation === 'AWAIT_APPROVAL_GATE') {
      artifact = { approvalRequired: true, mutationStarted: false };
      log.push('Stopped at founder approval gate.');
    } else if (taskNode.operation === 'REPLAN_FROM_FAILURE') {
      artifact = { failureHandled: true, previousFailure: context.previousFailure || null };
      log.push('Previous verifier failure was converted into replan input.');
    } else {
      status = 'FAIL';
      artifact = { error: `Unsupported operation: ${taskNode.operation}` };
      log.push(artifact.error);
    }

    return {
      agent: 'Executor Agent',
      taskId: taskNode.id,
      operation: taskNode.operation,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      logs: log,
      artifact
    };
  }
}

class VerifierAgent {
  verify(taskNode, executionResult) {
    const failures = [];
    if (!executionResult) failures.push('missing execution result');
    if (executionResult && executionResult.taskId !== taskNode.id) failures.push('executor returned mismatched task id');
    if (executionResult && executionResult.status !== 'PASS') failures.push(`executor status was ${executionResult.status}`);
    if (taskNode.operation === 'AWAIT_APPROVAL_GATE' && executionResult.artifact.mutationStarted) {
      failures.push('approval gate started mutation');
    }
    if (taskNode.operation === 'CAPABILITY_CHECK' && !Array.isArray(executionResult.artifact.capabilities)) {
      failures.push('capability check did not return capability registry');
    }
    if (claimsUnsupportedCompletion(executionResult)) {
      failures.push('execution logs claim completion without artifact proof');
    }
    return {
      agent: 'Verifier Agent',
      taskId: taskNode.id,
      passed: failures.length === 0,
      failures,
      hallucinationRisk: failures.some((failure) => /claim|proof|missing/.test(failure)) ? 'ELEVATED' : 'LOW',
      next: failures.length ? 'Return failure to Planner Agent for replan.' : 'Continue to next ready task.'
    };
  }
}

function runCodexStyleAgentLoop({ goal = '', root = process.cwd(), maxIterations = 2 } = {}) {
  const memoryLayer = new MemoryLayer({ root });
  const chief = new ChiefAgent();
  const planner = new PlannerAgent();
  const executor = new ExecutorAgent();
  const verifier = new VerifierAgent();
  const memorySnapshot = memoryLayer.snapshot(goal);
  const chiefBrief = chief.understand(goal, memorySnapshot.memories);
  const iterations = [];
  let previousFailure = null;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const plan = planner.createPlan({ chiefBrief, memorySnapshot, previousFailure });
    const executionResults = [];
    const verifications = [];
    for (const node of plan.taskGraph.nodes) {
      const result = executor.executeOne(node, {
        objective: goal,
        chiefBrief,
        memorySnapshot,
        previousFailure
      });
      const verification = verifier.verify(node, result);
      executionResults.push(result);
      verifications.push(verification);
      if (!verification.passed) break;
    }
    const failed = verifications.find((item) => !item.passed);
    iterations.push({ plan, executionResults, verifications });
    if (!failed) {
      return {
        status: 'SUCCESS',
        chiefBrief,
        memorySnapshot,
        iterations,
        final: 'All planned tasks passed verification. Execution stopped at approval gate for real-world mutation.'
      };
    }
    previousFailure = { taskId: failed.taskId, reason: failed.failures.join('; ') };
  }

  return {
    status: 'NEEDS_REPLAN',
    chiefBrief,
    memorySnapshot,
    iterations,
    final: 'Verifier failure persisted after bounded replanning.'
  };
}

function formatCodexStyleAgentLoop(result) {
  const latest = result.iterations[result.iterations.length - 1] || {};
  const plan = latest.plan || { predictedFailures: [], taskGraph: { nodes: [] } };
  return [
    'Codex-style phone agent system',
    `Status: ${result.status}`,
    `Objective: ${result.chiefBrief.objective}`,
    `Mode: ${result.chiefBrief.mode}`,
    '',
    'Agents:',
    '- Chief Agent: understands objective and delegates.',
    '- Planner Agent: builds structured task graph and predicts failures.',
    '- Executor Agent: executes exactly one task at a time.',
    '- Verifier Agent: checks proof, missing steps, and hallucination risk.',
    '- Memory Layer: retrieves roadmap, decisions, product memory, and architecture context before planning.',
    '',
    'Task graph:',
    ...plan.taskGraph.nodes.map((node) => `- ${node.id}: ${node.name} (${node.operation}) after [${node.dependsOn.join(', ') || 'none'}]`),
    '',
    'Predicted failures:',
    ...plan.predictedFailures.map((failure) => `- ${failure}`),
    '',
    'Future phone capabilities:',
    ...FUTURE_PHONE_CAPABILITIES.map((capability) => `- ${capability.label}: ${capability.status}`),
    '',
    result.final
  ].join('\n');
}

function task(id, name, operation, description, dependsOn) {
  return {
    id,
    name,
    operation,
    description,
    dependsOn,
    status: 'PENDING'
  };
}

function classifyObjective(goal) {
  const text = goal.toLowerCase();
  if (/accessibility|notification|app control|phone/.test(text)) return 'PHONE_OPERATED_LONG_HORIZON';
  if (/code|file|commit|implement|execute/.test(text)) return 'GOVERNED_EXECUTION';
  if (/explain|screenshot|understand/.test(text)) return 'PHASE2_EXPLAIN';
  return 'PRODUCT_STEWARDSHIP';
}

function inferConstraints(goal, memories) {
  const constraints = [
    'conversation is not execution',
    'no autonomous sending',
    'founder approval required before mutation',
    'preserve Phase 1 keyboard foundation'
  ];
  if (/phone|accessibility|notification|app control/i.test(goal)) {
    constraints.push('phone capabilities remain gated until Android permission and safety policies exist');
  }
  if (memories.some((memory) => /privacy|local-first|raw typed text/i.test(memory.preview))) {
    constraints.push('privacy boundary must remain local-first and auditable');
  }
  return constraints;
}

function inferSuccessCriteria(goal) {
  return [
    'objective decomposed into tasks',
    'plan includes predicted failures',
    'executor handles one task only',
    'verifier returns pass/fail',
    'failure loop replans instead of pretending success',
    'phone capabilities are future-compatible but gated'
  ];
}

function predictFailures(goal, chiefBrief) {
  const failures = [
    'planner may produce vague tasks if objective lacks success criteria',
    'executor may overreach if task operation is not bounded',
    'verifier may miss hallucination if proof artifacts are absent'
  ];
  if (chiefBrief.mode === 'PHONE_OPERATED_LONG_HORIZON') {
    failures.push('Android Accessibility and Notification access can become privacy or control risks without explicit gates');
  }
  if (/commit|write|modify|execute/i.test(goal)) {
    failures.push('execution must stop at governance and founder approval before mutation');
  }
  return failures;
}

function decomposeObjective(goal) {
  const units = [
    'understand objective',
    'retrieve relevant memory',
    'build task graph',
    'execute one bounded task',
    'verify result',
    'replan on failure'
  ];
  if (/phone|accessibility|notification|app/i.test(goal)) {
    units.push('check future phone capability gates');
  }
  return units;
}

function proposeNextStep(goal, chiefBrief) {
  if (chiefBrief.mode === 'PHONE_OPERATED_LONG_HORIZON') {
    return {
      classification: 'ARCHITECTURE_FOUNDATION',
      action: 'Define permission-gated phone capability adapters before implementing app control.',
      approvalRequired: true
    };
  }
  if (chiefBrief.mode === 'PHASE2_EXPLAIN') {
    return {
      classification: 'PHASE2_EXPLAIN',
      action: 'Prepare Explain workflow proposal with screenshot privacy and confirmation gate.',
      approvalRequired: true
    };
  }
  return {
    classification: 'PRODUCT_STEWARDSHIP',
    action: 'Produce a bounded proposal; do not mutate files without founder approval.',
    approvalRequired: true
  };
}

function claimsUnsupportedCompletion(executionResult = {}) {
  const text = (executionResult.logs || []).join(' ').toLowerCase();
  if (!/\b(done|fixed|completed|implemented)\b/.test(text)) return false;
  return !executionResult.artifact || Object.keys(executionResult.artifact).length === 0;
}

function tokenize(value) {
  return String(value || '').toLowerCase().match(/[a-z0-9_]+/g) || [];
}

function scoreRelevance(text, tokens) {
  const haystack = String(text || '').toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function compact(value = '', max = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  ChiefAgent,
  DEFAULT_MEMORY_FILES,
  ExecutorAgent,
  FUTURE_PHONE_CAPABILITIES,
  MemoryLayer,
  PlannerAgent,
  VerifierAgent,
  formatCodexStyleAgentLoop,
  runCodexStyleAgentLoop
};
