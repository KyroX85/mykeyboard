const fs = require('fs');
const path = require('path');
const { createNvidiaClient } = require('./nvidia-nim-client');
const { readRoadmap } = require('./roadmap-reader');
const { executeAiBridge } = require('../scripts/ai-execution-bridge');
const {
  readFounderMemory,
  buildFounderMemoryContext,
  rememberVisionCommand
} = require('./founder-memory');

const ROOT = path.resolve(__dirname, '..', '..');
const VISION_COMMAND_LOG_FILE = path.join(ROOT, 'ai-cto', 'vision-commands-log.json');

function readVisionCommandState() {
  try {
    if (!fs.existsSync(VISION_COMMAND_LOG_FILE)) return { version: '2.0', commands: [] };
    const parsed = JSON.parse(fs.readFileSync(VISION_COMMAND_LOG_FILE, 'utf8'));
    return {
      version: '2.0',
      commands: Array.isArray(parsed.commands) ? parsed.commands : []
    };
  } catch {
    return { version: '2.0', commands: [] };
  }
}

function latestDuplicateTargetDecision() {
  const commands = readVisionCommandState().commands;
  return [...commands].reverse().find((entry) =>
    entry &&
    entry.outcome === 'DUPLICATE_TARGET' &&
    entry.result &&
    entry.result.status === 'DUPLICATE_TARGET'
  ) || null;
}

function answerDuplicateTargetOption(option) {
  const entry = latestDuplicateTargetDecision();
  if (!entry) return null;
  const selected = String(option || '').trim();
  if (selected === '3') {
    return {
      command: 'duplicate_target_leave_unchanged',
      details: { agent: 'cto', intent: 'duplicate_target_leave_unchanged', visionCommand: entry },
      matchedRoute: 'duplicate_target_option',
      response: [
        'CTO: Founder, leaving it unchanged.',
        `File: ${entry.result.file}`,
        'No edit, no commit.'
      ].join('\n'),
      usedAi: false
    };
  }
  if (selected === '1') {
    return {
      command: 'duplicate_target_append_requested',
      details: { agent: 'cto', intent: 'duplicate_target_append_requested', visionCommand: entry },
      matchedRoute: 'duplicate_target_option',
      response: [
        'CTO: Founder, append needs exact content.',
        `File: ${entry.result.file}`,
        'Send: append "<text>" to this file'
      ].join('\n'),
      usedAi: false
    };
  }
  if (selected === '2') {
    return {
      command: 'duplicate_target_improve_requested',
      details: { agent: 'cto', intent: 'duplicate_target_improve_requested', visionCommand: entry },
      matchedRoute: 'duplicate_target_option',
      response: [
        'CTO: Founder, improvement needs review before editing an existing file.',
        `File: ${entry.result.file}`,
        'Send the exact improvement goal, and I will prepare a reviewed plan.'
      ].join('\n'),
      usedAi: false
    };
  }
  return null;
}

function writeVisionCommandState(state) {
  const next = {
    version: '2.0',
    commands: Array.isArray(state.commands) ? state.commands.slice(-200) : []
  };
  fs.mkdirSync(path.dirname(VISION_COMMAND_LOG_FILE), { recursive: true });
  fs.writeFileSync(VISION_COMMAND_LOG_FILE, JSON.stringify(next, null, 2));
  return next;
}

function createDeterministicVisionEntry(message) {
  const text = String(message || '');
  const normalized = text.toLowerCase();
  if (!/\b(test file|file)\b/.test(normalized)) return null;
  const action = /\b(remove|delete)\b/.test(normalized)
    ? 'remove'
    : /\b(create|add|make)\b/.test(normalized)
      ? 'create'
      : null;
  if (!action) return null;
  const file = inferFileFromLooseMessage(text);
  if (!file || isForbiddenVisionFile(file)) return null;
  const name = file.split('/').pop();
  const task = `${action === 'remove' ? 'Remove' : 'Create'} test file ${name}`;
  const entry = {
    id: `vision-${Date.now()}`,
    timestamp: new Date().toISOString(),
    command: message,
    plan: normalizePlan({
      task,
      files: [file],
      changes: [`${action === 'remove' ? 'Remove' : 'Create'} the requested test file`],
      risk: 'LOW',
      estimatedLines: 1,
      roadmapConflict: false
    }, message),
    approval: 'AUTO_ALLOWED',
    outcome: 'PLANNED',
    commitHash: null
  };
  const current = readVisionCommandState();
  writeVisionCommandState({ commands: [...current.commands, entry] });
  rememberVisionCommand({
    command: message,
    plan: entry.plan,
    approval: entry.approval,
    outcome: entry.outcome
  });
  return entry;
}

function createProductImprovementProposal(message) {
  const normalized = String(message || '').toLowerCase();
  if (!/\b(improve|fix|reduce|make|stabilize|smooth|optimize)\b/.test(normalized)) return null;
  const topic = detectProductImprovementTopic(normalized);
  if (!topic) return null;
  const files = protectedFilesForTopic(topic);
  return {
    command: 'product_improvement_review_required',
    details: {
      agent: 'cto',
      intent: 'product_improvement_review_required',
      topic,
      files
    },
    matchedRoute: 'product_improvement_proposal',
    response: formatProductImprovementProposal({ topic, files }),
    usedAi: false
  };
}

function detectProductImprovementTopic(normalized) {
  if (/\bswipe|gesture|trail|word resolver|long word\b/.test(normalized)) return 'swipe reliability';
  if (/\bpredict|prediction|predictor|suggestion|correction\b/.test(normalized)) return 'typing prediction';
  if (/\btyping|latency|keypress|lag|responsive|response|speed\b/.test(normalized)) return 'typing responsiveness';
  if (/\bbackspace|delete key|correction burst\b/.test(normalized)) return 'backspace comfort';
  if (/\bsymbol|emoji|number row|layout|spacing\b/.test(normalized)) return 'keyboard layout';
  if (/\bkeyboard|ime|input\b/.test(normalized)) return 'keyboard stability';
  return null;
}

function protectedFilesForTopic(topic) {
  switch (topic) {
    case 'swipe reliability':
      return [
        'app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt',
        'app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt',
        'app/src/main/java/com/example/mykeyboard/swipe/SwipeTrailView.kt'
      ];
    case 'typing prediction':
      return ['app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt'];
    case 'typing responsiveness':
      return [
        'app/src/main/java/com/example/mykeyboard/KeyboardService.kt',
        'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt'
      ];
    case 'backspace comfort':
      return ['app/src/main/java/com/example/mykeyboard/KeyboardService.kt'];
    case 'keyboard layout':
      return [
        'app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt',
        'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt',
        'app/src/main/res/layout/keyboard_container.xml'
      ];
    default:
      return ['app/src/main/java/com/example/mykeyboard/KeyboardService.kt'];
  }
}

function formatProductImprovementProposal({ topic, files }) {
  return [
    `CTO: Founder, ${topic} touches protected product code.`,
    'I will not edit it directly from chat.',
    `Files: ${files.slice(0, 3).join(', ')}`,
    'Options:',
    '1. Create a review plan only',
    '2. Prepare a staging-branch patch after validation',
    '3. Cancel'
  ].join('\n');
}

async function classifyVisionMessage({ message, state, memory, client = createNvidiaClient() }) {
  if (!client.available('llama')) return { type: 'NOT_VISION', reason: 'Llama unavailable.' };
  const founderMemory = buildFounderMemoryContext(readFounderMemory());
  const result = await client.chat('llama', [
    {
      role: 'user',
      content: [
        'Classify this founder WhatsApp message as VISION_COMMAND, CASUAL_CONVERSATION, or STANDARD_COMMAND.',
        'Vision command means founder describes something they want changed, improved, fixed, or built.',
        `Message: ${message}`,
        `Health: ${state && state.healthScore}`,
        `Recent memory: ${JSON.stringify((memory && memory.recentMessages || []).slice(-10))}`,
        `Founder preferences: ${JSON.stringify(founderMemory.founder_preferences)}`,
        `Product context: ${JSON.stringify(founderMemory.product_context)}`,
        `Last 5 decision history entries: ${JSON.stringify(founderMemory.recent_decisions)}`,
        `Last 3 conversation summaries: ${JSON.stringify(founderMemory.recent_conversation_summaries)}`
      ].join('\n')
    }
  ], {
    reason: 'Vision command intent detection',
    riskLevel: 'LOW',
    maxTokens: 80,
    temperature: 0
  });
  const type = /VISION_COMMAND/i.test(result.content) ? 'VISION_COMMAND' : 'NOT_VISION';
  return { type, raw: result.content };
}

async function createVisionPlan({ message, state, memory, client = createNvidiaClient() }) {
  const roadmap = readRoadmap();
  const founderMemory = buildFounderMemoryContext(readFounderMemory());
  const result = await client.chat('llama', [
    {
      role: 'user',
      content: [
        'Break this founder vision command into a safe technical plan.',
        'Return JSON only with keys: task, files, changes, risk, estimatedLines, roadmapConflict, conflictMessage.',
        'Risk must be LOW only for simple deterministic file/documentation/test-file changes.',
        'Respect Phase 1 stabilization. No Phase 2 AI learning/companion work during Phase 1 unless founder approves.',
        `Founder command: ${message}`,
        `Current roadmap phase: ${roadmap.currentPhase || 'unknown'}`,
        `Current health: ${state && state.healthScore}`,
        'If the founder asks for a Kotlin test file without a path, prefer app/src/main/java/<Name>.kt.',
        `Memory: ${JSON.stringify((memory && memory.recentMessages || []).slice(-10))}`,
        `Founder preferences: ${JSON.stringify(founderMemory.founder_preferences)}`,
        `Product context: ${JSON.stringify(founderMemory.product_context)}`,
        `Last 5 decision history entries: ${JSON.stringify(founderMemory.recent_decisions)}`,
        `Last 3 conversation summaries: ${JSON.stringify(founderMemory.recent_conversation_summaries)}`
      ].join('\n')
    }
  ], {
    reason: 'Vision command task breakdown',
    riskLevel: 'MEDIUM',
    maxTokens: 700,
    temperature: 0
  });
  const plan = normalizePlan(parseJsonObject(result.content), message);
  const entry = {
    id: `vision-${Date.now()}`,
    timestamp: new Date().toISOString(),
    command: message,
    plan,
    approval: plan.risk === 'LOW' ? 'AUTO_ALLOWED' : 'REQUIRED',
    outcome: 'PLANNED',
    commitHash: null
  };
  const current = readVisionCommandState();
  writeVisionCommandState({ commands: [...current.commands, entry] });
  rememberVisionCommand({
    command: message,
    plan,
    approval: entry.approval,
    outcome: entry.outcome
  });
  return entry;
}

async function executeVisionCommandEntry(entry, { root = process.cwd(), client = createNvidiaClient(), commit = false, push = false, commitMessage = null, validationCommand = null } = {}) {
  console.log('[whatsapp-cto] VISION EXECUTION: triggering execution');
  const approved = {
    ...entry,
    approval: entry.plan.risk === 'LOW' ? 'AUTO_EXECUTED' : 'APPROVED_BY_TOKEN',
    decidedAt: new Date().toISOString()
  };
  const duplicate = detectDuplicateCreateTarget(root, approved.plan);
  if (duplicate) {
    const completed = {
      ...approved,
      outcome: 'DUPLICATE_TARGET',
      commitHash: null,
      result: {
        status: 'DUPLICATE_TARGET',
        riskLevel: 'LOW',
        file: duplicate.file,
        reason: 'Requested file already exists.',
        options: [
          'Append notes to the existing file',
          'Improve the existing file after review',
          'Leave it unchanged'
        ]
      }
    };
    const state = readVisionCommandState();
    writeVisionCommandState({ commands: upsertCommand(state.commands, completed) });
    rememberVisionCommand({
      root,
      command: completed.command,
      plan: completed.plan,
      approval: completed.approval,
      outcome: completed.outcome,
      commitHash: null
    });
    return completed;
  }
  const result = await executeAiBridge({
    root,
    client,
    commit,
    push,
    commitMessage: commitMessage || commitMessageForPlan(approved.plan),
    validationCommand,
    skipLlamaReviewForLowRisk: approved.plan.risk === 'LOW',
    issue: planToIssue(approved.plan)
  });
  const completed = {
    ...approved,
    outcome: result.status,
    commitHash: result.commitHash || extractCommitHash(result.commitOutput),
    result
  };
  const state = readVisionCommandState();
  writeVisionCommandState({ commands: upsertCommand(state.commands, completed) });
  rememberVisionCommand({
    root,
    command: completed.command,
    plan: completed.plan,
    approval: completed.approval,
    outcome: completed.outcome,
    commitHash: completed.commitHash
  });
  return completed;
}

async function approveStatelessVisionCommand(token, options = {}) {
  const entry = decodeApprovalToken(token);
  if (!entry) return null;
  return executeVisionCommandEntry(entry, options);
}

function upsertCommand(commands, entry) {
  const list = Array.isArray(commands) ? commands : [];
  const exists = list.some((item) => item.id === entry.id);
  if (exists) return list.map((item) => item.id === entry.id ? entry : item);
  return [...list, entry];
}

function planToIssue(plan) {
  return {
    type: 'VISION_COMMAND',
    message: plan.task,
    file: Array.isArray(plan.files) ? plan.files[0] : plan.files,
    classification: plan.risk,
    reason: Array.isArray(plan.changes) ? plan.changes.join('; ') : plan.changes,
    deterministicContent: deterministicContentForPlan(plan),
    deterministicDelete: deterministicDeleteForPlan(plan)
  };
}

function detectDuplicateCreateTarget(root, plan) {
  const text = `${plan.task || ''} ${Array.isArray(plan.changes) ? plan.changes.join(' ') : plan.changes || ''}`.toLowerCase();
  if (!/\b(create|add|make)\b/.test(text)) return null;
  if (/\b(remove|delete)\b/.test(text)) return null;
  const files = Array.isArray(plan.files) ? plan.files : (plan.files ? [plan.files] : []);
  const existing = files.find((file) => fs.existsSync(repoPath(root, file)));
  return existing ? { file: existing } : null;
}

function repoPath(root, relativePath) {
  const resolved = path.resolve(root, String(relativePath || ''));
  const repoRoot = path.resolve(root);
  if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
    throw new Error(`Refusing path outside repo: ${relativePath}`);
  }
  return resolved;
}

function deterministicContentForPlan(plan) {
  const file = String(Array.isArray(plan.files) ? plan.files[0] : plan.files || '');
  const task = String(plan.task || '');
  if (!/test file/i.test(task)) return null;
  if (/\.kt$/i.test(file)) return '// Pipeline test file for CTO execution.\n';
  if (/\.java$/i.test(file)) return '// Pipeline test file for CTO execution.\n';
  if (/\.txt$/i.test(file)) return 'Pipeline test file for CTO execution.\n';
  return null;
}

function deterministicDeleteForPlan(plan) {
  const file = String(Array.isArray(plan.files) ? plan.files[0] : plan.files || '');
  const task = `${plan.task || ''} ${Array.isArray(plan.changes) ? plan.changes.join(' ') : plan.changes || ''}`;
  if (!/\b(remove|delete)\b/i.test(task)) return false;
  if (!/test file/i.test(task)) return false;
  return /\.(kt|java|txt)$/i.test(file);
}

function commitMessageForPlan(plan) {
  const file = Array.isArray(plan.files) ? plan.files[0] : plan.files;
  if (/Hello\.kt$/i.test(String(file || '')) && /\b(remove|delete)\b/i.test(String(plan.task || ''))) {
    return 'test: remove Hello.kt pipeline test';
  }
  if (/Hello\.kt$/i.test(String(file || '')) && /test file/i.test(String(plan.task || ''))) {
    return 'test: Hello.kt pipeline test';
  }
  return null;
}

function formatVisionPlan(entry) {
  const plan = entry.plan;
  if (plan.roadmapConflict) {
    return [
      'CTO: Founder, this improvement may conflict with the current roadmap phase.',
      plan.conflictMessage || 'We are in Phase 1 stabilization.',
      'Options:',
      '1. Schedule it for Phase 2',
      '2. Ask for a safer Phase 1 version',
      '3. Cancel'
    ].join('\n');
  }
  if (plan.risk === 'HIGH') {
    return [
      'CTO: Founder, this is high risk. I will not execute it automatically.',
      `Task: ${plan.task}`,
      `Files: ${plan.files.join(', ') || 'not identified'}`,
      'Options:',
      '1. Ask for a safer low-risk version',
      '2. Create a manual review plan',
      '3. Cancel'
    ].join('\n');
  }
  if (plan.risk === 'MEDIUM') {
    return [
      'CTO: Founder, this needs review before execution.',
      `Task: ${plan.task}`,
      `Files: ${plan.files.join(', ') || 'not identified'}`,
      `Risk: ${plan.risk}`,
      `Reply ${createApprovalCommand(entry)} to execute`
    ].join('\n');
  }
  return [
    'CTO: Founder, low-risk task accepted. Executing now.',
    `Task: ${plan.task}`,
    `Files: ${plan.files.join(', ') || 'not identified'}`,
    `Risk: ${plan.risk}`
  ].join('\n');
}

function formatVisionApprovalResult(entry) {
  const result = entry && entry.result || {};
  if (result.status === 'DUPLICATE_TARGET') {
    return [
      `CTO: Founder, ${result.file} already exists.`,
      'Options:',
      '1. Append notes to it',
      '2. Improve the existing file after review',
      '3. Leave it unchanged'
    ].join('\n');
  }
  if (result.status === 'COMPLETED') {
    const changedFiles = result.diff && Number(result.diff.filesChanged);
    if (!entry.commitHash && changedFiles === 0) {
      return [
        'CODER: Done, Founder.',
        `Checked: ${entry.plan.task}`,
        `Target: ${(result.file ? [result.file] : entry.plan.files).join(', ')}`,
        'Result: already clean; file is not present.',
        'Commit: not needed'
      ].join('\n');
    }
    return [
      'CODER: Done, Founder.',
      `Implemented: ${entry.plan.task}`,
      `Files changed: ${(result.file ? [result.file] : entry.plan.files).join(', ')}`,
      `Lines changed: ${(result.diff && result.diff.linesChanged) || 'within 50-line limit'}`,
      `Commit: ${entry.commitHash || 'not committed'}`,
      'Health: re-scan needed after next brain run'
    ].join('\n');
  }
  return [
    'CODER: Could not complete this safely, Founder.',
    `Result: ${result.status || entry && entry.outcome || 'UNKNOWN'}`,
    `Reason: ${result.reason || result.error || 'Execution blocked by guardrails.'}`
  ].join('\n');
}

function formatVisionNoTarget(entry) {
  return [
    'CTO: I need one exact file target, Founder.',
    `Task understood: ${entry.plan.task}`,
    'Send it like: create a test file called Hello.kt'
  ].join('\n');
}

function parseJsonObject(content) {
  try {
    return JSON.parse(String(content || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
  } catch {
    return {};
  }
}

function normalizePlan(plan, message) {
  const rawFiles = Array.isArray(plan.files) ? plan.files : (plan.files ? [plan.files] : []);
  const inferredFiles = inferFilesFromFounderMessage(message);
  const files = rawFiles.length > 0 ? rawFiles : inferredFiles;
  const normalizedFiles = files.map((file) => String(file).replace(/\\/g, '/')).filter(Boolean).slice(0, 3);
  const task = String(plan.task || message || 'Founder vision command').slice(0, 180);
  const estimatedLines = Number.isFinite(Number(plan.estimatedLines)) ? Number(plan.estimatedLines) : 50;
  return {
    task,
    files: normalizedFiles,
    changes: Array.isArray(plan.changes) ? plan.changes.slice(0, 5) : [String(plan.changes || 'No change list returned.')],
    risk: classifyVisionPlanRisk({ ...plan, task, files: normalizedFiles, estimatedLines }, message),
    estimatedLines,
    roadmapConflict: Boolean(plan.roadmapConflict),
    conflictMessage: plan.conflictMessage || null
  };
}

function classifyVisionPlanRisk(plan, message) {
  const text = `${message || ''} ${plan.task || ''} ${array(plan.changes).join(' ')}`.toLowerCase();
  const files = array(plan.files);
  if (files.some(isForbiddenVisionFile)) return 'HIGH';
  if (files.some(isProtectedProductFile)) return 'MEDIUM';
  if (/\b(remove|delete)\b/.test(text) && /\btest file\b/.test(text)) return 'LOW';
  if (/\b(create|add|make)\b/.test(text) && /\bfile\b/.test(text)) return 'LOW';
  if (Number(plan.estimatedLines) > 0 && Number(plan.estimatedLines) < 20) return 'LOW';
  if (/\b(comment|comments|color|colors|spacing|text|copy|label|wording)\b/.test(text)) return 'LOW';
  if (/\b(privacy|database|architecture|security|auth)\b/.test(text)) return 'HIGH';
  if (/\b(modify|change|update|add)\b/.test(text) && /\b(function|logic|existing)\b/.test(text)) return 'MEDIUM';
  return /HIGH/i.test(plan.risk) ? 'HIGH' : /MEDIUM/i.test(plan.risk) ? 'MEDIUM' : 'LOW';
}

function isProtectedProductFile(file) {
  const normalized = String(file || '').replace(/\\/g, '/').toLowerCase();
  return normalized.endsWith('/keyboardservice.kt') ||
    normalized.endsWith('/predictor/basicpredictor.kt') ||
    normalized.includes('/swipe/') ||
    normalized.includes('/metrics/') ||
    normalized.includes('/haptics/') ||
    normalized.endsWith('/keyboardsizingprofile.kt') ||
    normalized.endsWith('/keyboardsymbols.kt') ||
    normalized.endsWith('/longpresssymbolmap.kt') ||
    normalized.includes('build.gradle') ||
    normalized.includes('settings.gradle') ||
    normalized.includes('/privacy/') ||
    normalized.includes('database');
}

function isForbiddenVisionFile(file) {
  const normalized = String(file || '').replace(/\\/g, '/').toLowerCase();
  const basename = normalized.split('/').pop() || '';
  return normalized.endsWith('google-services.json') ||
    normalized.includes('/privacy/') ||
    normalized.includes('privacy') ||
    normalized.includes('databasehelper.kt') ||
    normalized.includes('/database/') ||
    normalized.includes('/db/') ||
    basename.includes('secret') ||
    basename.includes('key');
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function inferFilesFromFounderMessage(message) {
  const looseFile = inferFileFromLooseMessage(message);
  if (looseFile) return [looseFile];
  const text = String(message || '');
  const fileMatch = text.match(/\b([A-Za-z][\w.-]*\.(?:kt|java|js|json|md|xml|txt))\b/i);
  if (!fileMatch) return [];
  const fileName = fileMatch[1];
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.kt') || lower.endsWith('.java')) return [`app/src/main/java/${fileName}`];
  if (lower.endsWith('.md')) return [fileName];
  if (lower.endsWith('.json')) return [`ai-cto/${fileName}`];
  return [fileName];
}

function inferFileFromLooseMessage(message) {
  const text = String(message || '');
  const dotted = text.match(/\b([A-Za-z][\w.-]*\.(?:kt|java|txt))\b/i);
  if (dotted) return filePathForLooseName(dotted[1]);
  const compact = text.match(/\b([A-Za-z][\w-]*?)(kt|java|txt)\b/i);
  if (!compact) return null;
  return filePathForLooseName(`${compact[1]}.${compact[2]}`);
}

function filePathForLooseName(fileName) {
  const clean = String(fileName || '').replace(/\\/g, '/').split('/').pop();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  if (lower.endsWith('.kt') || lower.endsWith('.java')) {
    const [base, ext] = clean.split(/\.(?=[^.]+$)/);
    const formatted = `${base.charAt(0).toUpperCase()}${base.slice(1)}.${ext}`;
    return `app/src/main/java/${formatted}`;
  }
  if (lower.endsWith('.txt')) return clean;
  return null;
}

function createApprovalCommand(entry) {
  return `APPROVE-${encodeApprovalToken(entry)}`;
}

function encodeApprovalToken(entry) {
  const compactEntry = {
    id: entry.id,
    timestamp: entry.timestamp,
    command: entry.command,
    plan: entry.plan
  };
  return Buffer.from(JSON.stringify(compactEntry), 'utf8').toString('base64url');
}

function decodeApprovalToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(String(token || ''), 'base64url').toString('utf8'));
    if (!decoded || !decoded.plan || !decoded.plan.task) return null;
    return {
      id: decoded.id || `vision-${Date.now()}`,
      timestamp: decoded.timestamp || new Date().toISOString(),
      command: decoded.command || decoded.plan.task,
      plan: normalizePlan(decoded.plan, decoded.command || decoded.plan.task),
      approval: 'TOKEN',
      outcome: 'APPROVAL_TOKEN_RECEIVED',
      commitHash: null
    };
  } catch {
    return null;
  }
}

function extractCommitHash(output) {
  const match = String(output || '').match(/\[.+?\s+([a-f0-9]{7,40})\]/i);
  return match ? match[1] : null;
}

module.exports = {
  VISION_COMMAND_LOG_FILE,
  readVisionCommandState,
  writeVisionCommandState,
  answerDuplicateTargetOption,
  classifyVisionMessage,
  createVisionPlan,
  createDeterministicVisionEntry,
  createProductImprovementProposal,
  executeVisionCommandEntry,
  approveStatelessVisionCommand,
  formatVisionPlan,
  formatVisionApprovalResult,
  formatVisionNoTarget,
  normalizePlan,
  classifyVisionPlanRisk,
  isProtectedProductFile,
  isForbiddenVisionFile,
  inferFilesFromFounderMessage,
  createApprovalCommand,
  encodeApprovalToken,
  decodeApprovalToken
};
