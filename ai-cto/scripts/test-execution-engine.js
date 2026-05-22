const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const {
  classifyRisk,
  executeFirstFixableIssue,
  readActionLog
} = require('./execution-engine');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-exec-test-'));

function git(args) {
  return execFileSync('git', args, { cwd: tempRoot, encoding: 'utf8' }).trim();
}

try {
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'README.md'), 'Founder Sir trailing spaces    \nNeeds newline');
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', '.brain_state.json'), JSON.stringify({
    version: '3.0',
    healthScore: 80,
    unresolvedIssues: [{
      type: 'FORMATTING',
      impact: 'LOW',
      message: 'Trailing whitespace in README.md',
      file: 'README.md',
      source: 'TEST_SCAN',
      classification: 'LOW_RISK'
    }]
  }, null, 2));

  git(['init']);
  git(['config', 'user.email', 'cto-test@example.com']);
  git(['config', 'user.name', 'CTO Test']);
  git(['add', '.']);
  git(['commit', '-m', 'test fixture']);

  assert.strictEqual(classifyRisk({ type: 'FORMATTING', file: 'README.md' }).riskLevel, 'LOW');
  assert.strictEqual(classifyRisk({ type: 'SECURITY', file: 'app/src/main/java/Secret.kt' }).riskLevel, 'HIGH');
  assert.strictEqual(classifyRisk({ type: 'LOGIC', file: 'app/src/main/java/Feature.kt' }).riskLevel, 'MEDIUM');

  const result = executeFirstFixableIssue({
    root: tempRoot,
    validationCommand: [process.execPath, '-e', "require('fs').readFileSync('README.md','utf8').includes('    ') && process.exit(1)"],
    commit: true,
    push: false,
    now: new Date('2026-06-04T07:00:00.000Z')
  });

  assert.strictEqual(result.status, 'COMPLETED');
  assert.strictEqual(result.riskLevel, 'LOW');
  assert.strictEqual(fs.readFileSync(path.join(tempRoot, 'README.md'), 'utf8'), 'Founder Sir trailing spaces\nNeeds newline\n');
  assert(git(['log', '--oneline', '-1']).includes('cto: apply safe fix for README.md'));

  const log = readActionLog(tempRoot);
  assert(log.actions.some((entry) =>
    entry.agentName === 'CTO' &&
    entry.actionTaken.includes('executed safe fix') &&
    entry.outcome.includes('COMPLETED')
  ));

  fs.writeFileSync(path.join(tempRoot, 'README.md'), 'Bad trailing    \n');
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', '.brain_state.json'), JSON.stringify({
    version: '3.0',
    healthScore: 80,
    unresolvedIssues: [{
      type: 'FORMATTING',
      impact: 'LOW',
      message: 'Trailing whitespace in README.md',
      file: 'README.md',
      source: 'TEST_SCAN',
      classification: 'LOW_RISK'
    }]
  }, null, 2));
  git(['add', '.']);
  git(['commit', '-m', 'reset fixture for rollback']);

  const failed = executeFirstFixableIssue({
    root: tempRoot,
    validationCommand: [process.execPath, '-e', 'process.exit(1)'],
    commit: true,
    push: false,
    now: new Date('2026-06-04T08:00:00.000Z')
  });
  assert.strictEqual(failed.status, 'ROLLED_BACK');
  assert.strictEqual(fs.readFileSync(path.join(tempRoot, 'README.md'), 'utf8'), 'Bad trailing    \n');

  console.log('Execution engine checks passed.');
} catch (error) {
  throw error;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
