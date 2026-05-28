const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FOUNDER_MEMORY_FILE = process.env.ARITENIS_FOUNDER_MEMORY_FILE
  ? path.resolve(process.env.ARITENIS_FOUNDER_MEMORY_FILE)
  : path.join(ROOT, 'ai-cto', 'founder-memory.json');
const GITHUB_OWNER = 'KyroX85';
const GITHUB_REPO = 'mykeyboard';
const GITHUB_MEMORY_PATH = 'ai-cto/founder-memory.json';
const GITHUB_CONTENTS_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_MEMORY_PATH}`;
const GITHUB_BRANCH = 'main';
const MAX_DECISIONS = 500;
const MAX_VISION_COMMANDS = 300;
const MAX_SUMMARIES = 80;

const DEFAULT_FOUNDER_MEMORY = {
  founder_preferences: {
    tone: 'professional English only',
    approval_style: '3 options for big decisions',
    report_format: 'health + momentum + top 3 risks',
    language: 'English only, no Tamil slang'
  },
  product_context: {
    name: 'Aritenis AI',
    vision: 'emotional AI keyboard for Indian teenagers',
    current_phase: 'Phase 1 - Stabilization',
    phase_start: '2026-06-04',
    target_users: 'Indian teenagers',
    core_moat: 'passive behavioral keyboard data'
  },
  decision_history: [],
  vision_commands_history: [],
  milestones: [],
  learned_preferences: [],
  conversation_summaries: []
};

function memoryPath(root = ROOT) {
  if (root === ROOT && process.env.ARITENIS_FOUNDER_MEMORY_FILE) {
    return path.resolve(process.env.ARITENIS_FOUNDER_MEMORY_FILE);
  }
  return path.join(root, 'ai-cto', 'founder-memory.json');
}

function readFounderMemory(root = ROOT) {
  const file = memoryPath(root);
  try {
    if (!fs.existsSync(file)) return cloneDefault();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeFounderMemory(parsed);
  } catch {
    return cloneDefault();
  }
}

function writeFounderMemory(memory, root = ROOT) {
  const file = memoryPath(root);
  const normalized = normalizeFounderMemory(memory);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`);
  } catch {
    return normalized;
  }
  console.log(`[whatsapp-cto] FOUNDER MEMORY WRITE PATH: ${file}`);
  return normalized;
}

function rememberFounderInteraction({ root = ROOT, founderMessage, agentDecision, executed = false, outcome = 'RECORDED', commitHash = null } = {}) {
  const current = readFounderMemory(root);
  const entry = {
    timestamp: new Date().toISOString(),
    founder_asked: compact(founderMessage, 300),
    agents_decided: compact(agentDecision, 300),
    executed: Boolean(executed),
    outcome: compact(outcome, 300),
    commit_hash: commitHash || null
  };
  return writeFounderMemory({
    ...current,
    decision_history: [...current.decision_history, entry].slice(-MAX_DECISIONS)
  }, root);
}

function rememberVisionCommand({ root = ROOT, command, plan, approval, outcome, commitHash = null } = {}) {
  const current = readFounderMemory(root);
  const entry = {
    timestamp: new Date().toISOString(),
    command: compact(command, 300),
    plan: plan || null,
    approval: approval || 'PENDING',
    execution_result: outcome || 'WAITING',
    commit_hash: commitHash || null
  };
  return writeFounderMemory({
    ...current,
    vision_commands_history: [...current.vision_commands_history, entry].slice(-MAX_VISION_COMMANDS)
  }, root);
}

async function readFounderMemoryFromGitHub(options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN || '';
  if (!token) return { ok: false, memory: readFounderMemory(options.root || ROOT), reason: 'GITHUB_TOKEN missing' };
  const response = await githubFetch(GITHUB_CONTENTS_URL, {
    method: 'GET',
    headers: githubHeaders(token)
  }, options.fetchImpl);
  if (!response.ok) {
    return { ok: false, memory: readFounderMemory(options.root || ROOT), reason: `GitHub GET failed ${response.status}` };
  }
  const payload = await response.json();
  const content = Buffer.from(String(payload.content || ''), 'base64').toString('utf8');
  return {
    ok: true,
    memory: normalizeFounderMemory(JSON.parse(content)),
    sha: payload.sha || null,
    path: GITHUB_MEMORY_PATH
  };
}

async function writeFounderMemoryToGitHub(memory, options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN || '';
  if (!token) return { ok: false, reason: 'GITHUB_TOKEN missing' };
  const latest = await readFounderMemoryFromGitHub({ ...options, token });
  const normalized = normalizeFounderMemory(memory);
  const response = await githubFetch(GITHUB_CONTENTS_URL, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: options.message || 'chore: persist founder memory',
      content: Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, 'utf8').toString('base64'),
      sha: latest.sha || undefined,
      branch: GITHUB_BRANCH
    })
  }, options.fetchImpl);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { ok: false, reason: `GitHub PUT failed ${response.status}: ${body.slice(0, 200)}` };
  }
  const payload = await response.json();
  return {
    ok: true,
    memory: normalized,
    commitSha: payload.commit && payload.commit.sha || null,
    path: GITHUB_MEMORY_PATH
  };
}

function summarizeFounderWeek(root = ROOT, now = new Date()) {
  const current = readFounderMemory(root);
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = current.decision_history.filter((entry) => Date.parse(entry.timestamp) >= since.getTime());
  if (recent.length === 0) return current;
  const summary = {
    timestamp: now.toISOString(),
    period: `${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`,
    summary: `Recorded ${recent.length} founder interaction(s). Latest: ${recent[recent.length - 1].founder_asked || 'none'}.`
  };
  return writeFounderMemory({
    ...current,
    conversation_summaries: [...current.conversation_summaries, summary].slice(-MAX_SUMMARIES)
  }, root);
}

function buildFounderMemoryContext(memory = readFounderMemory()) {
  return {
    founder_preferences: memory.founder_preferences,
    product_context: memory.product_context,
    recent_decisions: memory.decision_history.slice(-5),
    recent_conversation_summaries: memory.conversation_summaries.slice(-3)
  };
}

function formatFounderMemorySummary(memory = readFounderMemory()) {
  const lastDecision = memory.decision_history[memory.decision_history.length - 1];
  const lastVision = memory.vision_commands_history[memory.vision_commands_history.length - 1];
  return [
    'Founder, memory summary',
    `Tone: ${memory.founder_preferences.tone}`,
    `Product: ${memory.product_context.name} - ${memory.product_context.current_phase}`,
    `Vision: ${memory.product_context.vision}`,
    `Last decision: ${lastDecision ? lastDecision.founder_asked : 'none recorded yet'}`,
    `Last vision command: ${lastVision ? lastVision.command : 'none recorded yet'}`
  ].join('\n');
}

function maybeCommitFounderMemory({ root = ROOT, push = false, enabled = true, force = false, now = new Date() } = {}) {
  if (!enabled) return { committed: false, reason: 'memory auto-commit disabled' };
  const file = path.join('ai-cto', 'founder-memory.json');
  if (!fs.existsSync(path.join(root, file))) return { committed: false, reason: 'memory file missing' };
  if (!hasMemoryChanges(root, file)) return { committed: false, reason: 'no memory changes' };
  if (!force && !memoryCommitDue(root, file, now)) return { committed: false, reason: 'last memory commit is under 24h old' };
  ensureGitIdentity(root);
  git(root, ['add', file]);
  const output = git(root, ['commit', '-m', 'chore: persist founder memory']);
  const hash = extractCommitHash(output) || git(root, ['rev-parse', '--short', 'HEAD']);
  if (push) pushWithToken(root);
  return { committed: true, hash };
}

function hasMemoryChanges(root, file) {
  try {
    return git(root, ['status', '--short', '--', file]).trim().length > 0;
  } catch {
    return false;
  }
}

function memoryCommitDue(root, file, now) {
  try {
    const last = git(root, ['log', '-1', '--format=%ct', '--', file]);
    if (!last) return true;
    return now.getTime() - Number(last) * 1000 >= 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

function ensureGitIdentity(root) {
  ensureGitConfig(root, 'user.email', process.env.GIT_AUTHOR_EMAIL || 'aritenis-cto@users.noreply.github.com');
  ensureGitConfig(root, 'user.name', process.env.GIT_AUTHOR_NAME || 'Aritenis CTO Agent');
}

function ensureGitConfig(root, key, fallback) {
  try {
    const current = git(root, ['config', '--get', key]);
    if (current) return;
  } catch {
    // Missing config is expected on Render.
  }
  git(root, ['config', key, fallback]);
}

function pushWithToken(root) {
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) return git(root, ['push']);
  const remote = git(root, ['remote', 'get-url', 'origin']);
  if (!/^https:\/\/github\.com\//i.test(remote)) return git(root, ['push']);
  const authed = remote.replace(/^https:\/\/github\.com\//i, `https://x-access-token:${token}@github.com/`);
  git(root, ['remote', 'set-url', 'origin', authed]);
  try {
    return git(root, ['push']);
  } finally {
    git(root, ['remote', 'set-url', 'origin', remote]);
  }
}

function normalizeFounderMemory(memory = {}) {
  return {
    founder_preferences: { ...DEFAULT_FOUNDER_MEMORY.founder_preferences, ...(memory.founder_preferences || {}) },
    product_context: { ...DEFAULT_FOUNDER_MEMORY.product_context, ...(memory.product_context || {}) },
    decision_history: array(memory.decision_history).slice(-MAX_DECISIONS),
    vision_commands_history: array(memory.vision_commands_history).slice(-MAX_VISION_COMMANDS),
    milestones: array(memory.milestones).slice(-MAX_SUMMARIES),
    learned_preferences: array(memory.learned_preferences).slice(-MAX_SUMMARIES),
    conversation_summaries: array(memory.conversation_summaries).slice(-MAX_SUMMARIES)
  };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'Aritenis-CTO-Agent'
  };
}

function githubFetch(url, options, fetchImpl) {
  const transport = fetchImpl || fetch;
  return transport(url, options);
}

function extractCommitHash(output) {
  const match = String(output || '').match(/\[.+?\s+([a-f0-9]{7,40})\]/i);
  return match ? match[1] : null;
}

function compact(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_FOUNDER_MEMORY));
}

module.exports = {
  FOUNDER_MEMORY_FILE,
  DEFAULT_FOUNDER_MEMORY,
  readFounderMemory,
  writeFounderMemory,
  rememberFounderInteraction,
  rememberVisionCommand,
  readFounderMemoryFromGitHub,
  writeFounderMemoryToGitHub,
  summarizeFounderWeek,
  buildFounderMemoryContext,
  formatFounderMemorySummary,
  maybeCommitFounderMemory,
  ensureGitIdentity
};
