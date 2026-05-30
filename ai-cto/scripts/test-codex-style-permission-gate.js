const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { routeMessageWithAi } = require('../whatsapp/command-router');

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-codex-gate-'));
  fs.mkdirSync(path.join(tempRoot, 'app', 'src', 'main', 'java'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', '.brain_state.json'), JSON.stringify({
    version: '3.0',
    unresolvedIssues: [],
    healthScore: 80,
    momentum: 'MOVING'
  }, null, 2));
  fs.writeFileSync(path.join(tempRoot, 'engineering-state.json'), JSON.stringify({
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] }
  }, null, 2));
  execFileSync('git', ['init'], { cwd: tempRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'cto-test@example.com'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.name', 'CTO Test'], { cwd: tempRoot });
  execFileSync('git', ['add', '.'], { cwd: tempRoot });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: tempRoot, stdio: 'ignore' });

  const plan = await routeMessageWithAi('create a test file called Hello.kt', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] }
  }, { recentMessages: [] }, {
    root: tempRoot,
    commit: true,
    push: false,
    deferLowRiskVisionExecution: true
  });

  assert.strictEqual(plan.command, 'vision_command_approval_required');
  assert.strictEqual(plan.matchedRoute, 'vision_command_review_required');
  assert(plan.response.includes('Execution Plan'));
  assert(plan.response.includes('Reply APPROVE-'));
  assert(plan.response.includes('No execution started'));
  assert(!plan.response.includes('Starting execution'));
  assert(!fs.existsSync(path.join(tempRoot, 'app', 'src', 'main', 'java', 'Hello.kt')));

  const approve = plan.response.match(/APPROVE-[A-Za-z0-9_-]+/)[0];
  const executed = await routeMessageWithAi(approve, {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] }
  }, { recentMessages: [] }, {
    root: tempRoot,
    commit: true,
    push: false,
    commitMessage: 'test: Hello.kt permission gate',
    validationCommand: [process.execPath, '-e', "require('fs').existsSync('app/src/main/java/Hello.kt') || process.exit(1)"]
  });

  assert.strictEqual(executed.command, 'vision_command_approved');
  assert(executed.response.includes('Commit:'));
  assert(fs.existsSync(path.join(tempRoot, 'app', 'src', 'main', 'java', 'Hello.kt')));

  const log = execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRoot, encoding: 'utf8' });
  assert(log.includes('test: Hello.kt permission gate'));

  console.log('Codex-style permission gate checks passed');
})();
