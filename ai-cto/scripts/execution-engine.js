const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_VALIDATION = [process.execPath, 'ai-cto/scripts/run-android-validation.js'];
const MAX_AUTO_FIXES_PER_DAY = 10;

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function repoPath(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const repoRoot = path.resolve(root);
  if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
    throw new Error(`Refusing path outside repo: ${relativePath}`);
  }
  return resolved;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function readBrainState(root = process.cwd()) {
  return readJson(path.join(root, 'ai-cto', '.brain_state.json'), {
    healthScore: null,
    unresolvedIssues: []
  });
}

function readActionLog(root = process.cwd()) {
  const log = readJson(path.join(root, 'ai-cto', 'agent-action-log.json'), { actions: [] });
  if (!Array.isArray(log.actions)) return { actions: [] };
  return log;
}

function appendActionLog(root, entry) {
  const logPath = path.join(root, 'ai-cto', 'agent-action-log.json');
  const log = readActionLog(root);
  log.actions.push(entry);
  writeJson(logPath, log);
}

function issueText(issue) {
  return [
    issue.type,
    issue.impact,
    issue.classification,
    issue.message,
    issue.reason,
    issue.file
  ].filter(Boolean).join(' ').toLowerCase();
}

function isForbiddenFile(file) {
  const normalized = normalizePath(file).toLowerCase();
  return (
    normalized.endsWith('google-services.json') ||
    normalized.includes('/privacy/') ||
    normalized.includes('privacy') ||
    normalized.includes('/database/') ||
    normalized.includes('/db/') ||
    normalized.includes('/schema') ||
    normalized.includes('/migration') ||
    normalized.includes('roomdatabase')
  );
}

function classifyRisk(issue = {}) {
  const text = issueText(issue);
  const file = normalizePath(issue.file);

  if (isForbiddenFile(file)) {
    return {
      riskLevel: 'HIGH',
      reason: 'Forbidden safety boundary file.',
      allowedAutoExecute: false
    };
  }

  if (/\b(security|secret|password|token|api[_ -]?key|auth|privacy|database|schema|migration|architecture|network|telemetry|persistence)\b/i.test(text) || /\bnew\s+feature\b/i.test(text)) {
    return {
      riskLevel: 'HIGH',
      reason: 'Security, privacy, data, architecture, or feature scope requires founder review.',
      allowedAutoExecute: false
    };
  }

  if (/\b(logic|function|dependency|gradle|package\.json|algorithm|kotlin|java|behavior)\b/i.test(text)) {
    return {
      riskLevel: 'MEDIUM',
      reason: 'Logic or dependency scoped change must run on a staging branch.',
      allowedAutoExecute: false
    };
  }

  if (/\b(format|formatting|spacing|trailing|whitespace|newline|unused import|documentation|docs|comment)\b/i.test(text)) {
    return {
      riskLevel: 'LOW',
      reason: 'Deterministic cleanup with no runtime behavior change.',
      allowedAutoExecute: true
    };
  }

  return {
    riskLevel: 'MEDIUM',
    reason: 'Unknown fix scope is treated as review-required.',
    allowedAutoExecute: false
  };
}

function findCandidateIssue(state) {
  const issues = [
    ...(Array.isArray(state.unresolvedIssues) ? state.unresolvedIssues : []),
    ...(Array.isArray(state.risks) ? state.risks : []),
    ...(Array.isArray(state.findings) ? state.findings : [])
  ];
  return issues.find((issue) => issue && issue.file);
}

function dailyAutoFixCount(root, now) {
  const day = now.toISOString().slice(0, 10);
  return readActionLog(root).actions.filter((entry) =>
    String(entry.timestamp || '').startsWith(day) &&
    String(entry.actionTaken || '').includes('executed safe fix')
  ).length;
}

function normalizeTextFile(content) {
  return content
    .replace(/[ \t]+$/gm, '')
    .replace(/\s*$/, '\n');
}

function applySafeTargetedFix(root, issue) {
  const relativeFile = normalizePath(issue.file);
  if (!relativeFile) throw new Error('Issue has no file.');
  if (isForbiddenFile(relativeFile)) throw new Error(`Forbidden file scope: ${relativeFile}`);

  const target = repoPath(root, relativeFile);
  if (!fs.existsSync(target)) throw new Error(`File not found: ${relativeFile}`);

  const before = fs.readFileSync(target, 'utf8');
  const after = normalizeTextFile(before);
  if (before === after) {
    return {
      changed: false,
      files: [relativeFile],
      before,
      after,
      summary: 'No safe text cleanup was needed.'
    };
  }

  fs.writeFileSync(target, after);
  return {
    changed: true,
    files: [relativeFile],
    before,
    after,
    summary: 'Removed trailing whitespace and normalized final newline.'
  };
}

function runCommand(root, command) {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error('Validation command is required.');
  }
  const [cmd, ...args] = command;
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function rollbackFiles(root, originals) {
  for (const [relativeFile, content] of Object.entries(originals)) {
    fs.writeFileSync(repoPath(root, relativeFile), content);
  }
}

function commitFix(root, files, message) {
  git(root, ['add', ...files]);
  git(root, ['add', 'ai-cto/agent-action-log.json']);
  return git(root, ['commit', '-m', message]);
}

function executeFirstFixableIssue(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const now = options.now || new Date();
  const state = readBrainState(root);
  const issue = options.issue || findCandidateIssue(state);

  if (!issue) {
    return { status: 'NO_FIXABLE_ISSUE', message: 'No issue with a file target was found.' };
  }

  const risk = classifyRisk(issue);
  const timestamp = now.toISOString();
  const healthScore = Number(state.healthScore);

  if (Number.isFinite(healthScore) && healthScore < 20) {
    appendActionLog(root, {
      timestamp,
      agentName: 'CTO',
      actionTaken: 'blocked execution',
      reason: 'Health score below 20.',
      riskLevel: risk.riskLevel,
      outcome: 'BLOCKED'
    });
    return { status: 'BLOCKED', riskLevel: risk.riskLevel, reason: 'Health score below 20.' };
  }

  if (dailyAutoFixCount(root, now) >= MAX_AUTO_FIXES_PER_DAY) {
    appendActionLog(root, {
      timestamp,
      agentName: 'CTO',
      actionTaken: 'blocked execution',
      reason: 'Daily auto-fix limit reached.',
      riskLevel: risk.riskLevel,
      outcome: 'BLOCKED'
    });
    return { status: 'BLOCKED', riskLevel: risk.riskLevel, reason: 'Daily auto-fix limit reached.' };
  }

  if (risk.riskLevel !== 'LOW') {
    const status = risk.riskLevel === 'MEDIUM' ? 'STAGING_REQUIRED' : 'FOUNDER_APPROVAL_REQUIRED';
    appendActionLog(root, {
      timestamp,
      agentName: 'CTO',
      actionTaken: 'blocked direct execution',
      reason: risk.reason,
      riskLevel: risk.riskLevel,
      outcome: status
    });
    return {
      status,
      riskLevel: risk.riskLevel,
      reason: risk.reason,
      options: [
        'Approve a staging branch fix',
        'Skip this issue for now',
        'Ask CTO for a safer patch proposal'
      ]
    };
  }

  const applied = applySafeTargetedFix(root, issue);
  const originals = Object.fromEntries(applied.files.map((file) => [file, applied.before]));

  if (!applied.changed) {
    appendActionLog(root, {
      timestamp,
      agentName: 'CTO',
      actionTaken: `checked safe fix for ${applied.files.join(', ')}`,
      reason: risk.reason,
      riskLevel: risk.riskLevel,
      outcome: 'NO_CHANGE'
    });
    return { status: 'NO_CHANGE', riskLevel: risk.riskLevel, files: applied.files };
  }

  try {
    runCommand(root, options.validationCommand || DEFAULT_VALIDATION);
  } catch (error) {
    rollbackFiles(root, originals);
    appendActionLog(root, {
      timestamp,
      agentName: 'CTO',
      actionTaken: `rolled back safe fix for ${applied.files.join(', ')}`,
      reason: 'Validation failed after applying the fix.',
      riskLevel: risk.riskLevel,
      outcome: 'ROLLED_BACK'
    });
    return {
      status: 'ROLLED_BACK',
      riskLevel: risk.riskLevel,
      files: applied.files,
      error: String(error.message || error)
    };
  }

  appendActionLog(root, {
    timestamp,
    agentName: 'CTO',
    actionTaken: `executed safe fix for ${applied.files.join(', ')}`,
    reason: risk.reason,
    riskLevel: risk.riskLevel,
    outcome: 'COMPLETED'
  });

  let commitOutput = null;
  if (options.commit !== false) {
    commitOutput = commitFix(root, applied.files, `cto: apply safe fix for ${applied.files[0]}`);
  }

  if (options.push === true) {
    if (risk.riskLevel !== 'LOW') {
      throw new Error('Refusing to push medium/high risk execution directly.');
    }
    git(root, ['push']);
  }

  return {
    status: 'COMPLETED',
    riskLevel: risk.riskLevel,
    files: applied.files,
    summary: applied.summary,
    before: applied.before,
    after: applied.after,
    commitOutput
  };
}

if (require.main === module) {
  const result = executeFirstFixableIssue({
    commit: process.argv.includes('--commit'),
    push: process.argv.includes('--push')
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = {
  classifyRisk,
  executeFirstFixableIssue,
  readActionLog,
  readBrainState,
  findCandidateIssue
};
