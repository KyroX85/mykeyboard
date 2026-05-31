const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  readFounderMemory,
  writeFounderMemory,
  rememberFounderInteraction,
  rememberVisionCommand,
  buildFounderMemoryContext,
  formatFounderMemorySummary,
  maybeCommitFounderMemory,
  writeFounderMemoryToGitHub
} = require('../whatsapp/founder-memory');
const { routeMessage } = require('../whatsapp/command-router');
const { ACTION_LOG_FILE } = require('../whatsapp/agent-action-log');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'founder-memory-'));
const actionLogBackup = fs.existsSync(ACTION_LOG_FILE) ? fs.readFileSync(ACTION_LOG_FILE, 'utf8') : null;
const githubTokenBackup = process.env.GITHUB_TOKEN;

async function run() {
try {
  delete process.env.GITHUB_TOKEN;
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  execFileSync('git', ['init'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tempRoot });

  const initial = writeFounderMemory(readFounderMemory(tempRoot), tempRoot);
  assert.strictEqual(initial.founder_preferences.tone, 'professional English only');
  assert.strictEqual(initial.product_context.name, 'Aritenis');
  assert(initial.product_context.vision.includes('Explain-first'));

  rememberFounderInteraction({
    root: tempRoot,
    founderMessage: 'create a test file called Hello.kt',
    agentDecision: 'vision_command_auto_executed',
    executed: false,
    outcome: 'Plan generated'
  });
  rememberVisionCommand({
    root: tempRoot,
    command: 'create a test file called Hello.kt',
    plan: { task: 'Create Hello.kt', files: ['app/src/main/java/Hello.kt'] },
    approval: 'YES',
    outcome: 'COMPLETED',
    commitHash: 'abc1234'
  });

  const memory = readFounderMemory(tempRoot);
  const context = buildFounderMemoryContext(memory);
  assert.strictEqual(context.recent_decisions.length, 1);
  assert.strictEqual(context.founder_preferences.language, 'English only, no Tamil slang');
  assert(formatFounderMemorySummary(memory).includes('create a test file called Hello.kt'));

  const githubMemory = {
    ...readFounderMemory(tempRoot)
  };
  let latestContent = `${JSON.stringify(githubMemory, null, 2)}\n`;
  const githubCalls = [];
  const fetchImpl = async (url, request) => {
    githubCalls.push({ url, request });
    if (request.method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sha: 'sha-before',
          content: Buffer.from(latestContent, 'utf8').toString('base64')
        })
      };
    }
    const body = JSON.parse(request.body);
    latestContent = Buffer.from(body.content, 'base64').toString('utf8');
    return {
      ok: true,
      status: 200,
      json: async () => ({ commit: { sha: 'commit-after' }, content: { sha: 'sha-after' } })
    };
  };
  const saved = await writeFounderMemoryToGitHub({
    ...readFounderMemory(tempRoot),
    milestones: [{ timestamp: new Date().toISOString(), summary: 'GitHub memory write test' }]
  }, { root: tempRoot, token: ['github', 'token'].join('-'), fetchImpl });
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(githubCalls[0].request.headers.Authorization, `Bearer ${['github', 'token'].join('-')}`);
  assert(githubCalls.some((call) => call.request.method === 'PUT'));
  assert.strictEqual(JSON.parse(latestContent).milestones[0].summary, 'GitHub memory write test');

  const routed = routeMessage('memory', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [], nextPriority: [], completedFixes: [] },
    changed: { completed: [], newRisks: [] },
    summary: { nextPriority: 'none', topRisk: 'none' }
  }, memory);
  assert.strictEqual(routed.command, 'memory');

  execFileSync('git', ['add', 'ai-cto/founder-memory.json'], { cwd: tempRoot });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: tempRoot });
  rememberFounderInteraction({
    root: tempRoot,
    founderMessage: 'what was the last thing fixed',
    agentDecision: 'memory',
    outcome: 'Answered from founder-memory.json'
  });
  const commit = maybeCommitFounderMemory({
    root: tempRoot,
    push: false,
    now: new Date(Date.now() + 25 * 60 * 60 * 1000)
  });
  assert.strictEqual(commit.committed, true);
  assert(commit.hash);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  if (actionLogBackup == null) {
    if (fs.existsSync(ACTION_LOG_FILE)) fs.unlinkSync(ACTION_LOG_FILE);
  } else {
    try {
      fs.writeFileSync(ACTION_LOG_FILE, actionLogBackup);
    } catch (error) {
      if (error.code !== 'EPERM') throw error;
    }
  }
  if (githubTokenBackup == null) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = githubTokenBackup;
}
}

run().then(() => {
  console.log('Founder memory checks passed.');
});
