const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  safetyCheck
} = require('./safe-maintenance-engine');

const root = process.cwd();
const actionsFile = path.join(root, 'ai-cto', 'maintenance-actions.json');
const original = fs.existsSync(actionsFile) ? fs.readFileSync(actionsFile, 'utf8') : null;

try {
  const safe = safetyCheck({
    action: 'documentation-cleanup',
    file: 'README.md',
    reason: 'Trim documentation whitespace.',
    risk: 'LOW',
    rollback_method: 'git checkout -- README.md'
  });
  assert.strictEqual(safe.ok, true);

  const dangerous = safetyCheck({
    action: 'kotlin-cleanup',
    file: 'app/src/main/java/com/example/MyClass.kt',
    reason: 'Kotlin logic modification.',
    risk: 'LOW',
    rollback_method: 'git checkout -- app/src/main/java/com/example/MyClass.kt'
  });
  assert.strictEqual(dangerous.ok, false);

  const malformed = safetyCheck({
    action: 'cleanup',
    file: 'README.md',
    reason: 'Missing rollback.',
    risk: 'LOW'
  });
  assert.strictEqual(malformed.ok, false);

  require('./safe-maintenance-engine').main();
  const dryRunLog = JSON.parse(fs.readFileSync(actionsFile, 'utf8'));
  assert(Array.isArray(dryRunLog.actions));
  assert(dryRunLog.actions.some((action) => action.result === 'DRY_RUN' || action.result === 'BLOCKED'));

  console.log('Safe maintenance engine checks passed.');
} catch (error) {
  throw error;
} finally {
  if (original === null) {
    if (fs.existsSync(actionsFile)) fs.unlinkSync(actionsFile);
  } else {
    fs.writeFileSync(actionsFile, original);
  }
}
