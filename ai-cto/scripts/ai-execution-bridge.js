const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createNvidiaClient, MODEL_ASSIGNMENT, parseRiskLevel } = require('../whatsapp/nvidia-nim-client');
const { readBrainState, findCandidateIssue } = require('./execution-engine');

const MAX_DEEPSEEK_FIXES_PER_DAY = 5;
const MAX_LLAMA_CALLS_PER_DAY = 100;

function readText(file, fallback = '') {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback;
  } catch {
    return fallback;
  }
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function repoPath(root, relativePath) {
  const resolved = path.resolve(root, String(relativePath || ''));
  const repoRoot = path.resolve(root);
  if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
    throw new Error(`Refusing path outside repo: ${relativePath}`);
  }
  return resolved;
}

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isForbiddenFile(file) {
  const normalized = normalizePath(file).toLowerCase();
  return normalized.endsWith('google-services.json') ||
    normalized.includes('/privacy/') ||
    normalized.includes('privacy') ||
    normalized.includes('/database/') ||
    normalized.includes('/db/') ||
    normalized.includes('/schema') ||
    normalized.includes('/migration') ||
    normalized.includes('roomdatabase');
}

function readActionLog(root) {
  return readJson(path.join(root, 'ai-cto', 'agent-action-log.json'), { version: '1.0', actions: [] });
}

function appendActionLog(root, entry) {
  const current = readActionLog(root);
  const next = {
    version: '1.0',
    actions: [...(Array.isArray(current.actions) ? current.actions : []), {
      timestamp: new Date().toISOString(),
      ...entry
    }].slice(-500)
  };
  writeJson(path.join(root, 'ai-cto', 'agent-action-log.json'), next);
}

function dailyModelCount(root, model, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return readActionLog(root).actions.filter((entry) =>
    String(entry.timestamp || '').startsWith(day) &&
    String(entry.modelUsed || entry.outcome || '').includes(model)
  ).length;
}

function buildLlamaRiskPrompt(issue) {
  return [
    'Is this LOW, MEDIUM or HIGH risk to fix automatically?',
    'Consider: does it touch privacy, database, architecture, or security layer?',
    'Reply with only one risk level first.',
    '',
    `Issue: ${JSON.stringify(issue, null, 2)}`
  ].join('\n');
}

function buildDeepSeekFixPrompt({ file, issue, content, vision }) {
  return [
    'You are DeepSeek V4 Flash, the Code Brain for Aritenis AI.',
    'Fix only this specific issue. Do not change anything else.',
    'Return only the complete fixed file content.',
    '',
    `Aritenis vision context:\n${vision || 'No vision file found.'}`,
    '',
    `File: ${file}`,
    `Issue: ${JSON.stringify(issue, null, 2)}`,
    '',
    'Current complete file content:',
    content
  ].join('\n');
}

async function classifyRiskWithLlama({ client, issue, root, now }) {
  if (isForbiddenFile(issue.file)) return { riskLevel: 'HIGH', reason: 'Forbidden file scope.' };
  if (dailyModelCount(root, MODEL_ASSIGNMENT.llama.model, now) >= MAX_LLAMA_CALLS_PER_DAY) {
    return { riskLevel: 'HIGH', reason: 'Daily Llama API limit reached.' };
  }
  const prompt = buildLlamaRiskPrompt(issue);
  const result = await client.chat('llama', [{ role: 'user', content: prompt }], {
    reason: 'AI execution risk classification',
    riskLevel: 'MEDIUM',
    maxTokens: 120,
    temperature: 0
  });
  if (!result.ok) return { riskLevel: 'HIGH', reason: result.reason || result.error || 'Risk classifier unavailable.' };
  appendActionLog(root, {
    agentName: 'Reviewer',
    actionTaken: 'classified AI execution risk',
    reason: issue.message || issue.type || 'flagged issue',
    riskLevel: parseRiskLevel(result.content),
    outcome: `MODEL_OK tokens=${result.usage.total_tokens || 0}`,
    modelUsed: MODEL_ASSIGNMENT.llama.model,
    tokensConsumed: result.usage.total_tokens || 0
  });
  return { riskLevel: parseRiskLevel(result.content), reason: result.content };
}

async function generateFixWithDeepSeek({ client, root, issue, file, content }) {
  const vision = readText(path.join(root, 'ai-cto', 'VISION_NORTH_STAR.md'));
  const prompt = buildDeepSeekFixPrompt({ file, issue, content, vision });
  const result = await client.chat('deepseek', [
    { role: 'user', content: prompt }
  ], {
    reason: 'AI code fix generation',
    riskLevel: 'LOW',
    maxTokens: Math.max(1000, Math.min(8000, content.length + 1200)),
    temperature: 0
  });
  appendActionLog(root, {
    agentName: 'Coder',
    actionTaken: `generated AI fix for ${file}`,
    reason: issue.message || issue.type || 'flagged issue',
    riskLevel: 'LOW',
    outcome: result.ok ? 'MODEL_OK' : `MODEL_FAILED ${result.reason || result.error || ''}`.trim(),
    modelUsed: MODEL_ASSIGNMENT.deepseek.model,
    tokensConsumed: result.usage.total_tokens || 0
  });
  return result;
}

async function verifyFixWithLlama({ client, root, issue, file, before, after }) {
  const prompt = [
    'Verify whether this fix makes logical sense.',
    'Reject if it changes unrelated behavior or unsafe scope.',
    'Reply APPROVED or REJECTED first.',
    `File: ${file}`,
    `Issue: ${JSON.stringify(issue)}`,
    `Before length: ${before.length}`,
    `After length: ${after.length}`
  ].join('\n');
  const result = await client.chat('llama', [{ role: 'user', content: prompt }], {
    reason: 'AI fix sanity verification',
    riskLevel: 'LOW',
    maxTokens: 160,
    temperature: 0
  });
  appendActionLog(root, {
    agentName: 'Reviewer',
    actionTaken: `verified AI fix for ${file}`,
    reason: issue.message || issue.type || 'flagged issue',
    riskLevel: 'LOW',
    outcome: result.ok ? result.content.slice(0, 120) : `MODEL_FAILED ${result.reason || result.error || ''}`.trim(),
    modelUsed: MODEL_ASSIGNMENT.llama.model,
    tokensConsumed: result.usage.total_tokens || 0
  });
  return result.ok && !/^REJECTED\b/i.test(result.content);
}

function runValidation(root, file, validationCommand) {
  if (validationCommand) {
    execFileSync(validationCommand[0], validationCommand.slice(1), { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    return;
  }
  if (/\.js$/i.test(file)) {
    execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  } else if (/\.(kt|java)$/i.test(file) && fs.existsSync(path.join(root, 'gradlew'))) {
    const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execFileSync(gradle, ['lintDebug'], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  }
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
}

function commitFix(root, files, message) {
  git(root, ['add', ...files, 'ai-cto/agent-action-log.json']);
  return git(root, ['commit', '-m', message]);
}

async function executeAiBridge(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const now = options.now || new Date();
  const client = options.client || createNvidiaClient();
  const state = readBrainState(root);
  const issue = options.issue || findCandidateIssue(state);

  if (!issue || !issue.file) return { status: 'NO_FIXABLE_ISSUE', reason: 'No issue with file target.' };
  if (!client.available('llama') || !client.available('deepseek')) {
    return { status: 'SKIPPED', reason: 'NVIDIA_DEEPSEEK_API_KEY and NVIDIA_LLAMA_API_KEY are required.' };
  }
  if (Number.isFinite(Number(state.healthScore)) && Number(state.healthScore) < 30) {
    return { status: 'BLOCKED', reason: 'Health score below 30.', riskLevel: 'HIGH' };
  }
  if (dailyModelCount(root, MODEL_ASSIGNMENT.deepseek.model, now) >= MAX_DEEPSEEK_FIXES_PER_DAY) {
    return { status: 'BLOCKED', reason: 'Daily DeepSeek fix limit reached.', riskLevel: 'HIGH' };
  }

  const file = normalizePath(issue.file);
  if (isForbiddenFile(file)) return { status: 'FOUNDER_APPROVAL_REQUIRED', riskLevel: 'HIGH', reason: 'Forbidden file scope.' };
  const target = repoPath(root, file);
  if (!fs.existsSync(target)) return { status: 'NO_FIXABLE_ISSUE', reason: `File not found: ${file}` };

  const risk = await classifyRiskWithLlama({ client, issue, root, now });
  if (risk.riskLevel === 'HIGH') {
    return {
      status: 'FOUNDER_APPROVAL_REQUIRED',
      riskLevel: 'HIGH',
      reason: risk.reason,
      options: ['Approve a human-reviewed patch plan', 'Skip this issue', 'Ask for safer diagnostic only']
    };
  }

  const before = fs.readFileSync(target, 'utf8');
  const generated = await generateFixWithDeepSeek({ client, root, issue, file, content: before });
  if (!generated.ok || !generated.content) return { status: 'MODEL_FAILED', riskLevel: risk.riskLevel, reason: generated.reason || generated.error };

  const after = stripCodeFence(generated.content);
  const verified = await verifyFixWithLlama({ client, root, issue, file, before, after });
  if (!verified) return { status: 'DISCARDED', riskLevel: risk.riskLevel, reason: 'Llama rejected the fix.' };

  if (risk.riskLevel === 'MEDIUM') {
    return {
      status: 'STAGING_REQUIRED',
      riskLevel: 'MEDIUM',
      file,
      diffPreview: `AI fix ready for ${file}; create PR branch for founder review.`,
      founderMessage: `⚖️ REVIEWER: Fix ready for ${issue.message || file}\nRisk: MEDIUM - needs your review\nReply APPROVE or REJECT`
    };
  }

  fs.writeFileSync(target, after);
  try {
    runValidation(root, file, options.validationCommand);
  } catch (error) {
    fs.writeFileSync(target, before);
    appendActionLog(root, {
      agentName: 'Coder',
      actionTaken: `rolled back DeepSeek fix for ${file}`,
      reason: 'Validation failed after AI fix.',
      riskLevel: risk.riskLevel,
      outcome: `ROLLED_BACK ${error.message}`,
      modelUsed: MODEL_ASSIGNMENT.deepseek.model,
      tokensConsumed: generated.usage.total_tokens || 0
    });
    return { status: 'ROLLED_BACK', riskLevel: risk.riskLevel, file, error: error.message };
  }

  let commitOutput = null;
  if (options.commit !== false) commitOutput = commitFix(root, [file], `cto: apply AI fix for ${file}`);
  if (options.push === true) git(root, ['push']);

  appendActionLog(root, {
    agentName: 'Coder',
    actionTaken: `executed DeepSeek fix for ${file}`,
    reason: issue.message || issue.type || 'flagged issue',
    riskLevel: 'LOW',
    outcome: 'COMPLETED',
    modelUsed: MODEL_ASSIGNMENT.deepseek.model,
    tokensConsumed: generated.usage.total_tokens || 0
  });

  return {
    status: 'COMPLETED',
    riskLevel: 'LOW',
    file,
    modelUsed: { fix: MODEL_ASSIGNMENT.deepseek.model, reviewer: MODEL_ASSIGNMENT.llama.model },
    commitOutput,
    report: [
      `🔧 CODER: Fixed ${file}`,
      '🧠 Brain used: DeepSeek V4 Flash',
      `✅ Result: ${options.commit === false ? 'applied without commit' : 'committed'}`,
      `📝 Commit: ${commitOutput ? firstLine(commitOutput) : 'not committed'}`
    ].join('\n')
  };
}

function stripCodeFence(value) {
  return String(value || '').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/)[0];
}

if (require.main === module) {
  executeAiBridge({
    commit: process.argv.includes('--commit'),
    push: process.argv.includes('--push')
  }).then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status === 'ROLLED_BACK' || result.status === 'MODEL_FAILED') process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  MAX_DEEPSEEK_FIXES_PER_DAY,
  MAX_LLAMA_CALLS_PER_DAY,
  buildLlamaRiskPrompt,
  buildDeepSeekFixPrompt,
  executeAiBridge
};
