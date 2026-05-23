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
  setPendingVisionCommand,
  readPendingVisionCommand,
  clearPendingVisionCommand,
  buildFounderMemoryContext,
  formatFounderMemorySummary,
  maybeCommitFounderMemory
} = require('../whatsapp/founder-memory');
const { routeMessage } = require('../whatsapp/command-router');
const { ACTION_LOG_FILE } = require('../whatsapp/agent-action-log');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'founder-memory-'));
const actionLogBackup = fs.existsSync(ACTION_LOG_FILE) ? fs.readFileSync(ACTION_LOG_FILE, 'utf8') : null;

try {
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  execFileSync('git', ['init'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tempRoot });

  const initial = writeFounderMemory(readFounderMemory(tempRoot), tempRoot);
  assert.strictEqual(initial.founder_preferences.tone, 'professional English only');
  assert.strictEqual(initial.product_context.name, 'Aritenis AI');

  rememberFounderInteraction({
    root: tempRoot,
    founderMessage: 'create a test file called Hello.kt',
    agentDecision: 'vision_command_pending',
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

  setPendingVisionCommand({
    id: 'vision-test',
    command: 'create a test file called Hello.kt',
    plan: { task: 'Create Hello.kt', files: ['app/src/main/java/Hello.kt'] },
    approval: 'PENDING',
    outcome: 'WAITING_FOR_FOUNDER'
  }, tempRoot);
  assert.strictEqual(readPendingVisionCommand(tempRoot).command, 'create a test file called Hello.kt');
  clearPendingVisionCommand(tempRoot);
  assert.strictEqual(readPendingVisionCommand(tempRoot), null);

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
    fs.writeFileSync(ACTION_LOG_FILE, actionLogBackup);
  }
}

console.log('Founder memory checks passed.');
