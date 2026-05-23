const fs = require('fs');
const path = require('path');
const { createNvidiaClient, MODEL_ASSIGNMENT } = require('./nvidia-nim-client');
const { readRoadmap } = require('./roadmap-reader');
const { executeAiBridge } = require('../scripts/ai-execution-bridge');

const ROOT = path.resolve(__dirname, '..', '..');
const VISION_COMMAND_LOG_FILE = path.join(ROOT, 'ai-cto', 'vision-commands-log.json');

function readVisionCommandState() {
  try {
    if (!fs.existsSync(VISION_COMMAND_LOG_FILE)) return { version: '1.0', pending: null, commands: [] };
    const parsed = JSON.parse(fs.readFileSync(VISION_COMMAND_LOG_FILE, 'utf8'));
    return {
      version: '1.0',
      pending: parsed.pending || null,
      commands: Array.isArray(parsed.commands) ? parsed.commands : []
    };
  } catch {
    return { version: '1.0', pending: null, commands: [] };
  }
}

function writeVisionCommandState(state) {
  const next = {
    version: '1.0',
    pending: state.pending || null,
    commands: Array.isArray(state.commands) ? state.commands.slice(-200) : []
  };
  fs.mkdirSync(path.dirname(VISION_COMMAND_LOG_FILE), { recursive: true });
  fs.writeFileSync(VISION_COMMAND_LOG_FILE, JSON.stringify(next, null, 2));
  return next;
}

async function classifyVisionMessage({ message, state, memory, client = createNvidiaClient() }) {
  if (!client.available('llama')) return { type: 'NOT_VISION', reason: 'Llama unavailable.' };
  const result = await client.chat('llama', [
    {
      role: 'user',
      content: [
        'Classify this founder WhatsApp message as VISION_COMMAND, CASUAL_CONVERSATION, or STANDARD_COMMAND.',
        'Vision command means founder describes something they want changed, improved, fixed, or built.',
        `Message: ${message}`,
        `Health: ${state && state.healthScore}`,
        `Recent memory: ${JSON.stringify((memory && memory.recentMessages || []).slice(0, 5))}`
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
  const result = await client.chat('llama', [
    {
      role: 'user',
      content: [
        'Break this founder vision command into a safe technical plan.',
        'Return JSON only with keys: task, files, changes, risk, estimatedLines, roadmapConflict, conflictMessage.',
        'Respect Phase 1 stabilization. No Phase 2 AI learning/companion work during Phase 1 unless founder approves.',
        `Founder command: ${message}`,
        `Current roadmap phase: ${roadmap.currentPhase || 'unknown'}`,
        `Current health: ${state && state.healthScore}`,
        `Memory: ${JSON.stringify((memory && memory.recentMessages || []).slice(0, 5))}`
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
    approval: 'PENDING',
    outcome: 'WAITING_FOR_FOUNDER',
    commitHash: null
  };
  const current = readVisionCommandState();
  writeVisionCommandState({
    pending: entry,
    commands: [...current.commands, entry]
  });
  return entry;
}

function cancelPendingVisionCommand() {
  const state = readVisionCommandState();
  if (!state.pending) return null;
  const cancelled = {
    ...state.pending,
    approval: 'NO',
    outcome: 'CANCELLED',
    decidedAt: new Date().toISOString()
  };
  writeVisionCommandState({
    pending: null,
    commands: state.commands.map((item) => item.id === cancelled.id ? cancelled : item)
  });
  return cancelled;
}

async function approvePendingVisionCommand({ root = process.cwd(), client = createNvidiaClient(), commit = false, push = false }) {
  const state = readVisionCommandState();
  if (!state.pending) return null;
  const pending = {
    ...state.pending,
    approval: 'YES',
    decidedAt: new Date().toISOString()
  };
  const result = await executeAiBridge({
    root,
    client,
    commit,
    push,
    issue: planToIssue(pending.plan)
  });
  const completed = {
    ...pending,
    outcome: result.status,
    commitHash: extractCommitHash(result.commitOutput),
    result
  };
  writeVisionCommandState({
    pending: null,
    commands: state.commands.map((item) => item.id === completed.id ? completed : item)
  });
  return completed;
}

function planToIssue(plan) {
  return {
    type: 'VISION_COMMAND',
    message: plan.task,
    file: Array.isArray(plan.files) ? plan.files[0] : plan.files,
    classification: plan.risk,
    reason: Array.isArray(plan.changes) ? plan.changes.join('; ') : plan.changes
  };
}

function formatVisionPlan(entry) {
  const plan = entry.plan;
  if (plan.roadmapConflict) {
    return [
      '🎯 CTO: Sir this improvement may conflict with current roadmap phase.',
      plan.conflictMessage || 'We are in Phase 1 stabilization.',
      'Options:',
      '1. Schedule it for Phase 2',
      '2. Proceed anyway with YES',
      '3. Cancel with NO'
    ].join('\n');
  }
  return [
    "🎯 CTO: Understood, Founder. Here's the plan:",
    `📋 Task: ${plan.task}`,
    `📁 Files: ${plan.files.join(', ') || 'not identified'}`,
    `⚠️ Risk: ${plan.risk}`,
    `📊 Scope: ~${plan.estimatedLines} lines changed`,
    'Reply YES to execute or NO to cancel'
  ].join('\n');
}

function formatVisionApprovalResult(entry) {
  const result = entry.result || {};
  if (result.status === 'COMPLETED') {
    return [
      '🔧 CODER: Done, Founder.',
      `Implemented: ${entry.plan.task}`,
      `Files changed: ${(result.file ? [result.file] : entry.plan.files).join(', ')}`,
      `Lines changed: ${(result.diff && result.diff.linesChanged) || 'within 50-line limit'}`,
      `Commit: ${entry.commitHash || 'not committed'}`,
      'Health: re-scan needed after next brain run'
    ].join('\n');
  }
  return [
    '🔧 CODER: Could not complete this safely, Founder.',
    `Result: ${result.status || entry.outcome}`,
    `Reason: ${result.reason || result.error || 'Execution blocked by guardrails.'}`
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
  const files = Array.isArray(plan.files) ? plan.files : (plan.files ? [plan.files] : []);
  return {
    task: String(plan.task || message || 'Founder vision command').slice(0, 180),
    files: files.map((file) => String(file).replace(/\\/g, '/')).filter(Boolean).slice(0, 3),
    changes: Array.isArray(plan.changes) ? plan.changes.slice(0, 5) : [String(plan.changes || 'No change list returned.')],
    risk: /HIGH/i.test(plan.risk) ? 'HIGH' : /MEDIUM/i.test(plan.risk) ? 'MEDIUM' : 'LOW',
    estimatedLines: Number.isFinite(Number(plan.estimatedLines)) ? Number(plan.estimatedLines) : 50,
    roadmapConflict: Boolean(plan.roadmapConflict),
    conflictMessage: plan.conflictMessage || null
  };
}

function extractCommitHash(output) {
  const match = String(output || '').match(/\[.+?\s+([a-f0-9]{7,40})\]/i);
  return match ? match[1] : null;
}

module.exports = {
  VISION_COMMAND_LOG_FILE,
  readVisionCommandState,
  writeVisionCommandState,
  classifyVisionMessage,
  createVisionPlan,
  cancelPendingVisionCommand,
  approvePendingVisionCommand,
  formatVisionPlan,
  formatVisionApprovalResult
};
