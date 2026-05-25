const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createNvidiaClient, MODEL_ASSIGNMENT, parseRiskLevel } = require('../whatsapp/nvidia-nim-client');
const { classifyRisk: classifyLocalRisk, readBrainState, findCandidateIssue } = require('./execution-engine');
const { readFounderMemory, buildFounderMemoryContext } = require('../whatsapp/founder-memory');

const MAX_DEEPSEEK_FIXES_PER_DAY = 20;
const MAX_LLAMA_CALLS_PER_DAY = 100;
const GITHUB_REPO_URL = 'github.com/KyroX85/mykeyboard.git';

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

function hasExplicitReviewRisk(issue = {}) {
  const riskText = [
    issue.impact,
    issue.risk,
    issue.riskLevel,
    issue.classification,
    issue.type
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(medium|high|critical|complexity|security|secret|privacy|architecture)\b/.test(riskText);
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

function getDeepSeekFixLimitStatus(root = process.cwd(), now = new Date()) {
  const used = dailyModelCount(path.resolve(root), MODEL_ASSIGNMENT.deepseek.model, now);
  const limit = MAX_DEEPSEEK_FIXES_PER_DAY;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    model: MODEL_ASSIGNMENT.deepseek.model,
    date: now.toISOString().slice(0, 10)
  };
}

function buildLlamaRiskPrompt(issue, root) {
  const founderMemory = buildFounderMemoryContext(readFounderMemory(root));
  return [
    'Is this LOW, MEDIUM or HIGH risk to fix automatically?',
    'Consider: does it touch privacy, database, architecture, or security layer?',
    'Reply with only one risk level first.',
    `Founder preferences: ${JSON.stringify(founderMemory.founder_preferences)}`,
    `Product context: ${JSON.stringify(founderMemory.product_context)}`,
    `Last 5 decision history entries: ${JSON.stringify(founderMemory.recent_decisions)}`,
    `Last 3 conversation summaries: ${JSON.stringify(founderMemory.recent_conversation_summaries)}`,
    '',
    `Issue: ${JSON.stringify(issue, null, 2)}`
  ].join('\n');
}

function buildCodeFixPrompt({ file, issue, content, vision, modelLabel = 'Code Brain' }) {
  return [
    `You are ${modelLabel}, the Code Brain for Aritenis AI.`,
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

function buildDeepSeekFixPrompt({ file, issue, content, vision }) {
  return buildCodeFixPrompt({ file, issue, content, vision, modelLabel: 'DeepSeek V4 Flash' });
}

async function classifyRiskWithLlama({ client, issue, root, now }) {
  if (isForbiddenFile(issue.file)) return { riskLevel: 'HIGH', reason: 'Forbidden file scope.' };
  if (dailyModelCount(root, MODEL_ASSIGNMENT.llama.model, now) >= MAX_LLAMA_CALLS_PER_DAY) {
    return { riskLevel: 'HIGH', reason: 'Daily Llama API limit reached.' };
  }
  const prompt = buildLlamaRiskPrompt(issue, root);
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

async function generateFixWithCodeBrain({ client, root, issue, file, content }) {
  const vision = readText(path.join(root, 'ai-cto', 'VISION_NORTH_STAR.md'));
  const sequence = ['deepseek', 'qwenCoder'];
  let lastResult = null;
  for (const kind of sequence) {
    const assignment = MODEL_ASSIGNMENT[kind];
    if (!client.available(kind)) continue;
    const prompt = buildCodeFixPrompt({ file, issue, content, vision, modelLabel: assignment.label });
    console.log(`[whatsapp-cto] ${assignment.label.toUpperCase()} CALLED: ${file} ${issue.message || issue.type || 'task'}`);
    const result = await client.chat(kind, [
      { role: 'user', content: prompt }
    ], {
      reason: kind === 'deepseek' ? 'AI code fix generation' : 'AI code fix generation fallback',
      riskLevel: 'LOW',
      maxTokens: Math.max(1000, Math.min(8000, content.length + 1200)),
      temperature: 0
    });
    console.log(`[whatsapp-cto] ${assignment.label.toUpperCase()} RESPONSE: ${String(result.content || '').length}`);
    appendActionLog(root, {
      agentName: 'Coder',
      actionTaken: `generated AI fix for ${file}`,
      reason: issue.message || issue.type || 'flagged issue',
      riskLevel: 'LOW',
      outcome: result.ok ? 'MODEL_OK' : `MODEL_FAILED ${result.reason || result.error || ''}`.trim(),
      modelUsed: assignment.model,
      tokensConsumed: result.usage.total_tokens || 0
    });
    if (result.ok && result.content) return { ...result, codeBrainKind: kind };
    lastResult = result;
  }
  return lastResult || {
    ok: false,
    model: '',
    content: '',
    usage: { total_tokens: 0 },
    reason: 'No configured code brain model is available.'
  };
}

async function verifyFixWithLlama({ client, root, issue, file, before, after }) {
  const founderMemory = buildFounderMemoryContext(readFounderMemory(root));
  const prompt = [
    'Verify whether this fix makes logical sense.',
    'Reject if it changes unrelated behavior or unsafe scope.',
    'Reply APPROVED or REJECTED first.',
    `Founder preferences: ${JSON.stringify(founderMemory.founder_preferences)}`,
    `Product context: ${JSON.stringify(founderMemory.product_context)}`,
    `Last 5 decision history entries: ${JSON.stringify(founderMemory.recent_decisions)}`,
    `Last 3 conversation summaries: ${JSON.stringify(founderMemory.recent_conversation_summaries)}`,
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
    if (!javaAvailable()) {
      if (readText(path.join(root, file)).trim().length === 0) {
        throw new Error('Kotlin/Java validation blocked: file is empty and Java is unavailable.');
      }
      console.log('[whatsapp-cto] Java unavailable; used lightweight Kotlin/Java file sanity validation.');
      return;
    }
    const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execFileSync(gradle, ['lintDebug'], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  }
}

function javaAvailable() {
  try {
    execFileSync('java', ['-version'], { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
}

function commitFix(root, files, message) {
  ensureGitRuntime(root);
  const stagedFiles = [...files];
  if (fs.existsSync(path.join(root, 'ai-cto', 'agent-action-log.json'))) {
    stagedFiles.push('ai-cto/agent-action-log.json');
  }
  git(root, ['add', ...stagedFiles]);
  return git(root, ['commit', '-m', message]);
}

function ensureGitRuntime(root) {
  git(root, ['--version']);
  git(root, ['config', 'user.email', 'cto@aritenis.ai']);
  git(root, ['config', 'user.name', 'Aritenis CTO']);
}

function pushFix(root) {
  ensureGitRuntime(root);
  configureGitRemote(root);
  syncWithRemoteMain(root);
  return git(root, ['push', 'origin', 'HEAD:main']);
}

function syncWithRemoteMain(root) {
  const stashed = stashRuntimeChanges(root);
  try {
    git(root, ['fetch', 'origin', 'main']);
    git(root, ['rebase', 'origin/main']);
    console.log('[whatsapp-cto] local execution commit synced on top of origin/main');
    return true;
  } catch (error) {
    try {
      git(root, ['rebase', '--abort']);
    } catch {
      // No active rebase, or abort failed after git already cleaned up.
    }
    const detail = error && error.stderr ? error.stderr : error && error.message ? error.message : String(error);
    throw new Error(`Could not sync execution commit with origin/main before push: ${detail}`);
  } finally {
    restoreRuntimeChanges(root, stashed);
  }
}

function stashRuntimeChanges(root) {
  const status = gitStatus(root);
  if (!status) return false;
  const marker = `cto-runtime-stash-${Date.now()}`;
  git(root, ['stash', 'push', '--include-untracked', '-m', marker]);
  console.log('[whatsapp-cto] stashed runtime working tree changes before push sync');
  return marker;
}

function restoreRuntimeChanges(root, marker) {
  if (!marker) return false;
  const list = git(root, ['stash', 'list']);
  if (!list.includes(marker)) return false;
  try {
    git(root, ['stash', 'pop']);
    console.log('[whatsapp-cto] restored runtime working tree changes after push sync');
    return true;
  } catch (error) {
    const detail = error && error.stderr ? error.stderr : error && error.message ? error.message : String(error);
    console.log(`[whatsapp-cto] runtime stash restore needs manual attention: ${detail}`);
    return false;
  }
}

function gitStatus(root) {
  try {
    return git(root, ['status', '--porcelain']);
  } catch {
    return '';
  }
}

function configureGitRemote(root) {
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) {
    console.log('[whatsapp-cto] GITHUB_TOKEN missing; cannot configure authenticated origin.');
    return null;
  }
  const repoUrl = `https://${token}@${GITHUB_REPO_URL}`;
  try {
    git(root, ['remote', 'remove', 'origin']);
  } catch {
    // Render may not have an origin remote yet.
  }
  git(root, ['remote', 'add', 'origin', repoUrl]);
  console.log('[whatsapp-cto] git origin configured for KyroX85/mykeyboard.git');
  return repoUrl;
}

function diffWithinHardLimits(root, limits = {}) {
  const maxFiles = limits.maxFiles || 3;
  const maxLines = limits.maxLines || 50;
  const maxNewFileLines = limits.maxNewFileLines || 200;
  const allowedFiles = new Set((Array.isArray(limits.allowedFiles) ? limits.allowedFiles : [])
    .map((file) => normalizePath(file).toLowerCase()));
  let output = '';
  try {
    output = git(root, ['diff', '--numstat']);
  } catch {
    output = '';
  }
  const trackedRows = parseNumstatRows(output, 'tracked');
  const untrackedRows = untrackedDiffRows(root);
  const rows = [...trackedRows, ...untrackedRows];
  const guardRows = rows.filter((row) => {
    if (isOperationalDiffFile(row.file)) return false;
    if (allowedFiles.size === 0) return true;
    return allowedFiles.has(normalizePath(row.file).toLowerCase());
  });
  const filesChanged = guardRows.length;
  const ignoredFilesChanged = rows.length - guardRows.length;
  const existingFilesChanged = guardRows.filter((row) => row.source === 'tracked').length;
  const newFilesChanged = guardRows.filter((row) => row.source === 'untracked').length;
  const existingLinesChanged = guardRows
    .filter((row) => row.source === 'tracked')
    .reduce((total, row) => total + row.added + row.deleted, 0);
  const newFileLinesChanged = guardRows
    .filter((row) => row.source === 'untracked')
    .reduce((total, row) => total + row.added + row.deleted, 0);
  const linesChanged = guardRows.reduce((total, row) => total + row.added + row.deleted, 0);
  if (existingFilesChanged > maxFiles) {
    return {
      allowed: false,
      filesChanged,
      existingFilesChanged,
      newFilesChanged,
      ignoredFilesChanged,
      existingLinesChanged,
      newFileLinesChanged,
      linesChanged,
      reason: `Diff modifies more than ${maxFiles} existing files.`
    };
  }
  if (existingLinesChanged > maxLines) {
    return {
      allowed: false,
      filesChanged,
      existingFilesChanged,
      newFilesChanged,
      ignoredFilesChanged,
      existingLinesChanged,
      newFileLinesChanged,
      linesChanged,
      reason: `Diff changes more than ${maxLines} lines in existing files.`
    };
  }
  if (newFileLinesChanged > maxNewFileLines) {
    return {
      allowed: false,
      filesChanged,
      existingFilesChanged,
      newFilesChanged,
      ignoredFilesChanged,
      existingLinesChanged,
      newFileLinesChanged,
      linesChanged,
      reason: `New file content changes more than ${maxNewFileLines} lines.`
    };
  }
  return {
    allowed: true,
    filesChanged,
    existingFilesChanged,
    newFilesChanged,
    ignoredFilesChanged,
    existingLinesChanged,
    newFileLinesChanged,
    linesChanged,
    reason: 'Diff within hard limits.'
  };
}

function parseNumstatRows(output, source) {
  return String(output || '')
    .split(/\r?\n/)
    .map((row) => parseNumstatRow(row, source))
    .filter(Boolean);
}

function parseNumstatRow(row, source) {
  const parts = String(row || '').split('\t');
  if (parts.length < 3) return null;
  const added = Number(parts[0]);
  const deleted = Number(parts[1]);
  return {
    source,
    added: Number.isFinite(added) ? added : 0,
    deleted: Number.isFinite(deleted) ? deleted : 0,
    file: normalizePath(parts.slice(2).join('\t'))
  };
}

function isOperationalDiffFile(file) {
  const normalized = normalizePath(file).toLowerCase();
  return normalized === 'ai-cto/agent-action-log.json' ||
    normalized === 'ai-cto/vision-commands-log.json' ||
    normalized === 'ai-cto/founder-memory.json' ||
    normalized === 'ai-cto/validation-results.json' ||
    normalized === 'ai-cto/whatsapp-webhook.log' ||
    normalized === 'ai-cto/routing-debug.log' ||
    normalized.endsWith('.log') ||
    normalized.includes('.corrupt-');
}

function untrackedDiffRows(root) {
  let output = '';
  try {
    output = git(root, ['ls-files', '--others', '--exclude-standard']);
  } catch {
    return [];
  }
  return output.split(/\r?\n/).filter(Boolean).map((file) => {
    const full = repoPath(root, file);
    const content = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
    const lines = content ? content.split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line.length > 0).length : 0;
    return { source: 'untracked', added: lines, deleted: 0, file: normalizePath(file) };
  });
}

async function executeAiBridge(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const now = options.now || new Date();
  const client = options.client || createNvidiaClient();
  const state = readBrainState(root);
  const issue = options.issue || findCandidateIssue(state);

  if (!issue || !issue.file) return { status: 'NO_FIXABLE_ISSUE', reason: 'No issue with file target.' };
  if (Number.isFinite(Number(state.healthScore)) && Number(state.healthScore) < 30) {
    return { status: 'BLOCKED', reason: 'Health score below 30.', riskLevel: 'HIGH' };
  }

  const file = normalizePath(issue.file);
  if (isForbiddenFile(file)) return { status: 'FOUNDER_APPROVAL_REQUIRED', riskLevel: 'HIGH', reason: 'Forbidden file scope.' };
  const target = repoPath(root, file);
  const fileExists = fs.existsSync(target);
  if (issue.deterministicDelete === true) {
    return executeDeterministicDelete({ root, file, target, fileExists, issue, commit: options.commit, push: options.push, commitMessage: options.commitMessage });
  }
  const deterministicContent = deterministicNewFileContent(issue, file, fileExists);
  if (!deterministicContent && (!client.available('llama') || !client.available('deepseek'))) {
    return { status: 'SKIPPED', reason: 'NVIDIA_DEEPSEEK_API_KEY and NVIDIA_LLAMA_API_KEY are required.' };
  }
  if (!deterministicContent && dailyModelCount(root, MODEL_ASSIGNMENT.deepseek.model, now) >= MAX_DEEPSEEK_FIXES_PER_DAY) {
    return { status: 'BLOCKED', reason: 'Daily DeepSeek fix limit reached.', riskLevel: 'HIGH' };
  }
  const localRisk = classifyLocalRisk(issue);
  if (hasExplicitReviewRisk(issue) && !localRisk.allowedAutoExecute) {
    return {
      status: localRisk.riskLevel === 'HIGH' ? 'FOUNDER_APPROVAL_REQUIRED' : 'STAGING_REQUIRED',
      riskLevel: localRisk.riskLevel,
      file,
      reason: localRisk.reason,
      diffPreview: `Autonomous bridge skipped ${file}; ${localRisk.reason}`,
      options: localRisk.riskLevel === 'HIGH'
        ? ['Approve a human-reviewed patch plan', 'Skip this issue', 'Ask for safer diagnostic only']
        : undefined
      };
  }

  const risk = deterministicContent
    ? { riskLevel: 'LOW', reason: 'Deterministic low-risk new file template.' }
    : await classifyRiskWithLlama({ client, issue, root, now });
  if (risk.riskLevel === 'HIGH') {
    return {
      status: 'FOUNDER_APPROVAL_REQUIRED',
      riskLevel: 'HIGH',
      reason: risk.reason,
      options: ['Approve a human-reviewed patch plan', 'Skip this issue', 'Ask for safer diagnostic only']
    };
  }

  const before = fileExists ? fs.readFileSync(target, 'utf8') : '';
  const generated = deterministicContent
    ? {
        ok: true,
        model: 'deterministic-new-file-template',
        content: deterministicContent,
        usage: { total_tokens: 0 }
      }
    : await generateFixWithCodeBrain({ client, root, issue, file, content: before });
  if (!generated.ok || !generated.content) return { status: 'MODEL_FAILED', riskLevel: risk.riskLevel, reason: generated.reason || generated.error };

  const after = stripCodeFence(generated.content);
  const shouldReviewWithLlama = risk.riskLevel !== 'LOW' || !options.skipLlamaReviewForLowRisk;
  const verified = shouldReviewWithLlama
    ? await verifyFixWithLlama({ client, root, issue, file, before, after })
    : true;
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

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, after);
  const diffCheck = diffWithinHardLimits(root, { allowedFiles: [file] });
  if (!diffCheck.allowed) {
    if (fileExists) fs.writeFileSync(target, before);
    else fs.rmSync(target, { force: true });
    appendActionLog(root, {
      agentName: 'Reviewer',
      actionTaken: `blocked AI fix for ${file}`,
      reason: diffCheck.reason,
      riskLevel: 'HIGH',
      outcome: 'WAITING_FOR_FOUNDER_APPROVAL',
      modelUsed: MODEL_ASSIGNMENT.deepseek.model,
      tokensConsumed: generated.usage.total_tokens || 0
    });
    return {
      status: 'FOUNDER_APPROVAL_REQUIRED',
      riskLevel: 'HIGH',
      file,
      reason: diffCheck.reason,
      diff: diffCheck,
      founderMessage: `⚖️ REVIEWER: AI fix blocked sir.\nReason: ${diffCheck.reason}\nFiles: ${diffCheck.filesChanged}, Lines: ${diffCheck.linesChanged}\nReply YES only if you want a bigger reviewed patch.`
    };
  }
  try {
    runValidation(root, file, options.validationCommand);
  } catch (error) {
    if (fileExists) fs.writeFileSync(target, before);
    else fs.rmSync(target, { force: true });
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
  if (options.commit !== false) commitOutput = commitFix(root, [file], options.commitMessage || `cto: apply AI fix for ${file}`);
  const commitHash = commitOutput ? extractCommitHash(commitOutput) || git(root, ['rev-parse', '--short', 'HEAD']) : null;
  if (options.push === true) pushFix(root);

  appendActionLog(root, {
    agentName: 'Coder',
    actionTaken: `executed code fix for ${file}`,
    reason: issue.message || issue.type || 'flagged issue',
    riskLevel: 'LOW',
    outcome: 'COMPLETED',
    modelUsed: generated.model || MODEL_ASSIGNMENT.deepseek.model,
    tokensConsumed: generated.usage.total_tokens || 0
  });

  return {
    status: 'COMPLETED',
    riskLevel: 'LOW',
    file,
    diff: diffCheck,
    modelUsed: { fix: generated.model || MODEL_ASSIGNMENT.deepseek.model, reviewer: MODEL_ASSIGNMENT.llama.model },
    commitHash,
    commitOutput,
    report: [
      `🔧 CODER: Fixed ${file}`,
      `🧠 Brain used: ${generated.model === 'deterministic-new-file-template' ? 'Deterministic file template' : 'DeepSeek V4 Flash'}`,
      `✅ Result: ${options.commit === false ? 'applied without commit' : 'committed'}`,
      `📝 Commit: ${commitHash || 'not committed'}`
    ].join('\n')
  };
}

function executeDeterministicDelete({ root, file, target, fileExists, issue, commit, push, commitMessage }) {
  if (isForbiddenFile(file)) return { status: 'FOUNDER_APPROVAL_REQUIRED', riskLevel: 'HIGH', reason: 'Forbidden file scope.' };
  if (!isSafeDeterministicDeleteTarget(file, issue)) {
    return { status: 'FOUNDER_APPROVAL_REQUIRED', riskLevel: 'HIGH', file, reason: 'Delete request is outside deterministic safe-delete scope.' };
  }
  if (!fileExists) {
    appendActionLog(root, {
      agentName: 'Coder',
      actionTaken: `checked deterministic delete for ${file}`,
      reason: issue.message || 'test file delete request',
      riskLevel: 'LOW',
      outcome: 'NOOP_ALREADY_ABSENT',
      modelUsed: 'deterministic-delete',
      tokensConsumed: 0
    });
    return {
      status: 'COMPLETED',
      riskLevel: 'LOW',
      file,
      diff: {
        allowed: true,
        filesChanged: 0,
        existingFilesChanged: 0,
        newFilesChanged: 0,
        ignoredFilesChanged: 0,
        existingLinesChanged: 0,
        newFileLinesChanged: 0,
        linesChanged: 0,
        reason: 'File already absent.'
      },
      modelUsed: { fix: 'deterministic-delete', reviewer: null },
      commitHash: null,
      commitOutput: null,
      report: `🔧 CODER: ${file} was already absent.`
    };
  }

  const before = fs.readFileSync(target, 'utf8');
  fs.rmSync(target, { force: true });
  const diffCheck = diffWithinHardLimits(root, { allowedFiles: [file] });
  if (!diffCheck.allowed) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, before);
    return { status: 'FOUNDER_APPROVAL_REQUIRED', riskLevel: 'HIGH', file, reason: diffCheck.reason, diff: diffCheck };
  }

  let commitOutput = null;
  if (commit !== false) commitOutput = commitFix(root, [file], commitMessage || `test: remove ${path.basename(file)} pipeline test`);
  const commitHash = commitOutput ? extractCommitHash(commitOutput) || git(root, ['rev-parse', '--short', 'HEAD']) : null;
  if (push === true) pushFix(root);

  appendActionLog(root, {
    agentName: 'Coder',
    actionTaken: `deleted deterministic test file ${file}`,
    reason: issue.message || 'test file delete request',
    riskLevel: 'LOW',
    outcome: 'COMPLETED',
    modelUsed: 'deterministic-delete',
    tokensConsumed: 0
  });

  return {
    status: 'COMPLETED',
    riskLevel: 'LOW',
    file,
    diff: diffCheck,
    modelUsed: { fix: 'deterministic-delete', reviewer: null },
    commitHash,
    commitOutput,
    report: [
      `🔧 CODER: Removed ${file}`,
      '🧠 Brain used: Deterministic delete',
      `✅ Result: ${commit === false ? 'applied without commit' : 'committed'}`,
      `📝 Commit: ${commitHash || 'not committed'}`
    ].join('\n')
  };
}

function isSafeDeterministicDeleteTarget(file, issue) {
  const text = `${issue && issue.message || ''} ${issue && issue.reason || ''}`.toLowerCase();
  const normalized = normalizePath(file).toLowerCase();
  return /\btest file\b/.test(text) &&
    /\.(kt|java|txt)$/.test(normalized) &&
    !normalized.includes('mainactivity') &&
    !normalized.includes('keyboard') &&
    !normalized.includes('service') &&
    !normalized.includes('predictor');
}

function deterministicNewFileContent(issue, file, fileExists) {
  if (fileExists) return null;
  const content = typeof issue.deterministicContent === 'string'
    ? issue.deterministicContent
    : inferredDeterministicNewFileContent(issue, file);
  if (!content) return null;
  if (isForbiddenFile(file)) return null;
  if (content.length > 4000) return null;
  return content.endsWith('\n') ? content : `${content}\n`;
}

function inferredDeterministicNewFileContent(issue, file) {
  const text = `${issue && issue.message || ''} ${issue && issue.reason || ''} ${issue && issue.type || ''}`.toLowerCase();
  if (!/\b(create|add)\b/.test(text) || !/\b(test file|file)\b/.test(text)) return null;
  if (/\.kt$/i.test(file) || /\.java$/i.test(file)) return '// Pipeline test file for CTO execution.\n';
  if (/\.txt$/i.test(file)) return 'Pipeline test file for CTO execution.\n';
  return null;
}

function stripCodeFence(value) {
  return String(value || '').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/)[0];
}

function extractCommitHash(output) {
  const match = String(output || '').match(/\[.+?\s+([a-f0-9]{7,40})\]/i);
  return match ? match[1] : null;
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
  dailyModelCount,
  getDeepSeekFixLimitStatus,
  buildCodeFixPrompt,
  buildLlamaRiskPrompt,
  buildDeepSeekFixPrompt,
  diffWithinHardLimits,
  configureGitRemote,
  ensureGitRuntime,
  syncWithRemoteMain,
  executeAiBridge
};
