const PRODUCT_HOT_PATH = /app\/src\/main\/java\/com\/example\/mykeyboard\/(KeyboardService|swipe\/|predictor\/|metrics\/|KeyboardSizingProfile|KeyboardSymbols|LongPressSymbolMap)/i;

function evaluateExecutionSanity({ files = [], linesChanged = 0, task = '', existingFilesChanged = null } = {}) {
  const normalized = array(files).map((file) => String(file || '').replace(/\\/g, '/'));
  const text = `${task} ${normalized.join(' ')}`.toLowerCase();
  const reasons = [];
  if (Number(linesChanged) > 50) reasons.push('giant diff blocked');
  if (existingFilesChanged != null && Number(existingFilesChanged) > 3) reasons.push('too many existing files changed');
  if (/\b(architecture rewrite|rewrite architecture|framework|modernize architecture|new abstraction|abstraction layer)\b/.test(text)) {
    reasons.push('architecture rewrite or unnecessary abstraction blocked');
  }
  if (/\b(wrapper|smart wrapper|orchestration layer)\b/.test(text)) reasons.push('duplicate wrapper or orchestration risk blocked');
  if (/\b(cosmetic churn|cleanup everything|mass cleanup|modernize all)\b/.test(text)) reasons.push('uncontrolled cleanup or cosmetic churn blocked');
  if (/\b(fake modernization|smart sounding|ai theater)\b/.test(text)) reasons.push('low-value modernization blocked');
  if (normalized.some((file) => PRODUCT_HOT_PATH.test(file)) && !/\bproposal|test|analysis\b/.test(text)) {
    reasons.push('product hot-path execution requires review');
  }
  return {
    allowed: reasons.length === 0,
    reasons,
    risk: reasons.length ? 'BLOCKED' : 'LOW'
  };
}

function enforcePreservationOnly(posture, action) {
  const mode = posture && posture.mode;
  const normalizedAction = String(action || '').toLowerCase();
  if (mode !== 'PRESERVATION_ONLY') return { allowed: true, reason: 'not in preservation-only mode' };
  if (/scan|report|analysis|proposal/.test(normalizedAction)) return { allowed: true, reason: 'read-only preservation action' };
  return { allowed: false, reason: 'PRESERVATION_ONLY blocks execution, commits, and pushes' };
}

function array(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

module.exports = {
  evaluateExecutionSanity,
  enforcePreservationOnly
};
