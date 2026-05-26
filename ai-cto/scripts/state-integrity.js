const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join('ai-cto', '.brain_state.json');
const BACKUP_DIR = path.join('ai-cto', 'state-backups');
const MAX_BACKUPS = 5;

function readBrainStateStrict(root = process.cwd(), { maxAgeHours = 36 } = {}) {
  const file = path.join(root, STATE_FILE);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const schema = validateBrainStateSchema(parsed);
    const stat = fs.statSync(file);
    const stale = Date.now() - stat.mtimeMs > maxAgeHours * 60 * 60 * 1000;
    return {
      ok: schema.ok && !stale,
      state: parsed,
      stale,
      errors: [...schema.errors, ...(stale ? ['state is stale'] : [])]
    };
  } catch (error) {
    return {
      ok: false,
      state: null,
      stale: false,
      errors: [`malformed state: ${error.message}`]
    };
  }
}

function writeBrainStateSafe(root = process.cwd(), state = {}) {
  const repoRoot = path.resolve(root);
  const target = path.join(repoRoot, STATE_FILE);
  rotateBackup(repoRoot);
  const schema = validateBrainStateSchema(state);
  if (!schema.ok) {
    throw new Error(`Refusing malformed brain state: ${schema.errors.join(', ')}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, target);
  rotateBackup(repoRoot);
  return { written: true, file: target };
}

function recoverBrainState(root = process.cwd()) {
  const repoRoot = path.resolve(root);
  const current = readBrainStateStrict(repoRoot);
  if (current.ok) return { recovered: false, reason: 'state already valid' };
  const backup = latestValidBackup(repoRoot);
  if (!backup) return { recovered: false, reason: 'no valid backup' };
  fs.copyFileSync(backup, path.join(repoRoot, STATE_FILE));
  return { recovered: true, backup };
}

function validateBrainStateSchema(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) errors.push('state must be object');
  if (state && state.healthScore != null && !Number.isFinite(Number(state.healthScore))) errors.push('healthScore must be numeric');
  for (const key of ['unresolvedIssues', 'risks', 'findings']) {
    if (state && state[key] != null && !Array.isArray(state[key])) errors.push(`${key} must be array`);
  }
  return { ok: errors.length === 0, errors };
}

function rotateBackup(root) {
  const source = path.join(root, STATE_FILE);
  if (!fs.existsSync(source)) return;
  const backupDir = path.join(root, BACKUP_DIR);
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `.brain_state.${Date.now()}.json`);
  fs.copyFileSync(source, backup);
  const backups = fs.readdirSync(backupDir)
    .filter((name) => name.startsWith('.brain_state.') && name.endsWith('.json'))
    .sort();
  while (backups.length > MAX_BACKUPS) {
    fs.rmSync(path.join(backupDir, backups.shift()), { force: true });
  }
}

function latestValidBackup(root) {
  const backupDir = path.join(root, BACKUP_DIR);
  if (!fs.existsSync(backupDir)) return null;
  const backups = fs.readdirSync(backupDir)
    .filter((name) => name.startsWith('.brain_state.') && name.endsWith('.json'))
    .sort()
    .reverse();
  for (const backup of backups) {
    const file = path.join(backupDir, backup);
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (validateBrainStateSchema(parsed).ok) return file;
    } catch {
      // Try older backup.
    }
  }
  return null;
}

module.exports = {
  readBrainStateStrict,
  writeBrainStateSafe,
  recoverBrainState,
  validateBrainStateSchema
};
