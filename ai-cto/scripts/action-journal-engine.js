const fs = require('fs');
const path = require('path');

const JOURNAL_FILE = path.join('ai-cto', 'action-journal.json');

function readActionJournal(root = process.cwd()) {
  const fallback = { version: '1.0', events: [], safeFailureMode: null };
  const journal = readJson(path.join(root, JOURNAL_FILE), fallback);
  return {
    version: journal.version || '1.0',
    events: Array.isArray(journal.events) ? journal.events : [],
    safeFailureMode: journal.safeFailureMode || null
  };
}

function recordJournalEvent(root = process.cwd(), event = {}) {
  const started = event.startedAt ? Date.parse(event.startedAt) : Date.now();
  const finished = event.finishedAt ? Date.parse(event.finishedAt) : Date.now();
  const entry = {
    timestamp: new Date().toISOString(),
    executionId: String(event.executionId || `exec-${Date.now()}`),
    action: String(event.action || 'execution').slice(0, 180),
    status: String(event.status || 'UNKNOWN'),
    validationResult: String(event.validationResult || 'UNKNOWN'),
    rollbackReason: event.rollbackReason ? String(event.rollbackReason).slice(0, 240) : null,
    durationMs: Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : Math.max(0, finished - started),
    founderApproved: Boolean(event.founderApproved),
    blockedReason: event.blockedReason ? String(event.blockedReason).slice(0, 240) : null,
    rejectedReason: event.rejectedReason ? String(event.rejectedReason).slice(0, 240) : null,
    files: Array.isArray(event.files) ? event.files.slice(0, 12) : []
  };
  const journal = readActionJournal(root);
  journal.events = [...journal.events, entry].slice(-1000);
  writeJson(path.join(root, JOURNAL_FILE), journal);
  return entry;
}

function repeatedFailureSummary(root = process.cwd(), windowSize = 20) {
  const recent = readActionJournal(root).events.slice(-windowSize);
  return {
    validationFailures: recent.filter((event) => event.validationResult === 'FAILED').length,
    rollbackCount: recent.filter((event) => event.status === 'ROLLED_BACK').length,
    blockedCount: recent.filter((event) => event.status === 'BLOCKED').length,
    rejectedCount: recent.filter((event) => event.status === 'REJECTED').length
  };
}

function shouldEnterSafeFailureMode(root = process.cwd(), context = {}) {
  const summary = repeatedFailureSummary(root);
  const reasons = [];
  if (summary.validationFailures >= 2) reasons.push('repeated validation failures');
  if (summary.rollbackCount >= 2) reasons.push('repeated rollbacks');
  if (Number(context.daysSinceFounderPresence || 0) >= 14) reasons.push('stale founder presence');
  if (Number(context.trustScore == null ? 100 : context.trustScore) < 60) reasons.push('trust collapse');
  if (context.governanceConsistent === false) reasons.push('governance inconsistency');
  if (context.stateIntegrityOk === false) reasons.push('corrupted state');
  if (context.checkpointsOk === false) reasons.push('missing checkpoints');

  const mode = reasons.length ? 'PRESERVATION_ONLY' : 'ACTIVE';
  const journal = readActionJournal(root);
  journal.safeFailureMode = mode === 'PRESERVATION_ONLY'
    ? { active: true, reasons, enteredAt: new Date().toISOString() }
    : null;
  writeJson(path.join(root, JOURNAL_FILE), journal);
  return {
    mode,
    reasons,
    allowed: mode === 'PRESERVATION_ONLY' ? ['scans', 'reports', 'analysis', 'proposals'] : ['execution', 'commits', 'pushes', 'analysis']
  };
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
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

module.exports = {
  readActionJournal,
  recordJournalEvent,
  repeatedFailureSummary,
  shouldEnterSafeFailureMode
};
