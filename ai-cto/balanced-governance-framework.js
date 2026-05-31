const HARD_SAFETY_RULES = [
  'preservation mode blocks all mutation',
  'no raw typed text, personal screenshots, clipboard data, or recoverable swipe trails leave local control',
  'no secret, key, token, privacy, database, schema, or migration mutation without founder approval',
  'no automatic sending, purchasing, publishing, deletion, or app control without explicit founder approval',
  'no paths outside the repository',
  'no giant diffs or broad rewrites in protected product areas'
];

const EXECUTION_RULES = [
  'one bounded task at a time',
  'run the narrowest relevant validation available',
  'keep rollback simple and explicit',
  'record what changed and what was verified',
  'respect diff limits unless founder approved a larger reviewed patch',
  'use staging/review for medium product risk when evidence is weak'
];

const SOFT_PREFERENCES = [
  'prefer founder approval for medium-risk work',
  'prefer report-only output for protected files',
  'prefer no architecture changes',
  'prefer smaller patches than necessary',
  'prefer conversation before execution when intent is unclear'
];

const DECISION_AUTHORITY = {
  BLOCK: 0,
  ASK_CONFIRMATION: 1,
  EXECUTE_WITH_CONSTRAINTS: 2,
  FULLY_AUTONOMOUS: 3
};

const NON_MUTATING_ACTIONS = new Set([
  'analysis',
  'scan',
  'summary',
  'report',
  'proposal',
  'conversation',
  'workflow_dispatch',
  'screenshot_capture',
  'product_lab',
  'memory_audit'
]);

const MUTATING_ACTIONS = new Set([
  'commit',
  'push',
  'file_write',
  'file_delete',
  'file_modify',
  'branch_create',
  'execute_mutation'
]);

const HARD_SAFETY_PATTERN = /secret|api[_ -]?key|token|password|privacy|database|schema|migration|raw typed|raw text|clipboard|auto.?send|purchase|payment|delete account|outside repo/i;
const REWRITE_PATTERN = /\b(rewrite|redesign|rebuild|modernize all|refactor everything|large rewrite|future-proof rewrite)\b/i;
const SOFT_PREFERENCE_PATTERN = /architecture cleanup|modernization|cosmetic|report|summary|docs?|documentation|comment|formatting|whitespace/i;

function decideGovernanceAuthority(input = {}) {
  const action = String(input.action || '').trim() || inferAction(input);
  const files = normalizeFiles(input.files || []);
  const text = [input.task, input.reason, ...(Array.isArray(input.changes) ? input.changes : [])].filter(Boolean).join(' ');
  const mode = String(input.mode || input.governanceMode || '').toUpperCase();
  const risk = String(input.riskLevel || input.risk || '').toUpperCase();
  const diff = input.diff || {};
  const evidence = input.evidence || {};
  const validation = input.validation || {};
  const protectedFiles = files.filter(isProtectedKeyboardPath);
  const hardReasons = hardSafetyReasons({ action, files, text, mode, diff });

  if (hardReasons.length) {
    return decision({
      level: DECISION_AUTHORITY.BLOCK,
      name: 'LEVEL_0_BLOCK',
      ruleLayer: 'Hard Safety Rules',
      allowed: false,
      requiresConfirmation: true,
      reasons: hardReasons,
      principle: 'Minimum Governance Required for Safe Execution'
    });
  }

  if (NON_MUTATING_ACTIONS.has(action)) {
    return decision({
      level: DECISION_AUTHORITY.FULLY_AUTONOMOUS,
      name: 'LEVEL_3_FULLY_AUTONOMOUS',
      ruleLayer: 'Execution Rules',
      allowed: true,
      requiresConfirmation: false,
      constraints: ['no file mutation', 'no commit', 'no automatic sending'],
      downgradedSoftPreferences: softPreferenceMatches(text),
      reasons: ['Non-mutating operational work should not wait for approval.'],
      principle: 'Minimum Governance Required for Safe Execution'
    });
  }

  if (isSafeLowRiskMaintenance({ action, files, text, risk, diff })) {
    return decision({
      level: DECISION_AUTHORITY.EXECUTE_WITH_CONSTRAINTS,
      name: 'LEVEL_2_EXECUTE_WITH_CONSTRAINTS',
      ruleLayer: 'Execution Rules',
      allowed: true,
      requiresConfirmation: false,
      constraints: ['max 3 files', 'max 50 existing-file changed lines', 'validation required', 'rollback required'],
      downgradedSoftPreferences: softPreferenceMatches(text),
      reasons: ['Low-risk bounded maintenance can execute without founder confirmation.'],
      principle: 'Minimum Governance Required for Safe Execution'
    });
  }

  if (risk === 'LOW_PRODUCT_RISK' && Number(diff.existingFilesChanged || diff.filesChanged || files.length || 0) <= 2 &&
    Number(diff.existingLinesChanged || diff.linesChanged || 0) <= 50) {
    return decision({
      level: DECISION_AUTHORITY.EXECUTE_WITH_CONSTRAINTS,
      name: 'LEVEL_2_EXECUTE_WITH_CONSTRAINTS',
      ruleLayer: 'Execution Rules',
      allowed: true,
      requiresConfirmation: false,
      constraints: ['bounded non-protected patch', 'validation required', 'rollback required'],
      downgradedSoftPreferences: ['approval preference downgraded because no hard safety or protected product risk is present'],
      reasons: ['Low product risk outside protected files should proceed with constraints, not approval loops.'],
      principle: 'Minimum Governance Required for Safe Execution'
    });
  }
  if (protectedFiles.length) {
    const evidenceStrong = Boolean(evidence.realDeviceEvidence || evidence.screenshotEvidence || evidence.aggregateMetrics || validation.testsPassed || validation.buildPassed);
    const tinyDiff = Number(diff.existingFilesChanged || diff.filesChanged || files.length || 0) <= 1 &&
      Number(diff.existingLinesChanged || diff.linesChanged || 0) <= 25;
    if (evidenceStrong && tinyDiff && !REWRITE_PATTERN.test(text)) {
      return decision({
        level: DECISION_AUTHORITY.EXECUTE_WITH_CONSTRAINTS,
        name: 'LEVEL_2_EXECUTE_WITH_CONSTRAINTS',
        ruleLayer: 'Execution Rules',
        allowed: true,
        requiresConfirmation: false,
        constraints: ['single protected area only', 'evidence required', 'before/after validation required', 'rollback trigger required'],
        downgradedSoftPreferences: ['protected files normally ask approval, but evidence plus tiny diff makes constrained execution acceptable'],
        reasons: ['Protected file is not automatically forbidden when evidence is strong and blast radius is tiny.'],
        principle: 'Minimum Governance Required for Safe Execution'
      });
    }
    return decision({
      level: DECISION_AUTHORITY.ASK_CONFIRMATION,
      name: 'LEVEL_1_ASK_CONFIRMATION',
      ruleLayer: 'Execution Rules',
      allowed: false,
      requiresConfirmation: true,
      constraints: ['prepare review plan or staging patch only'],
      reasons: ['Protected product file needs stronger evidence before mutation.'],
      principle: 'Minimum Governance Required for Safe Execution'
    });
  }

  if (risk === 'MEDIUM') {
    return decision({
      level: DECISION_AUTHORITY.EXECUTE_WITH_CONSTRAINTS,
      name: 'LEVEL_2_EXECUTE_WITH_CONSTRAINTS',
      ruleLayer: 'Execution Rules',
      allowed: true,
      requiresConfirmation: false,
      constraints: ['bounded patch', 'validation required', 'rollback required', 'no protected product files'],
      downgradedSoftPreferences: ['medium risk usually asks confirmation, but non-protected bounded work can proceed with constraints'],
      reasons: ['Medium risk outside hard-safety and hot-path areas should not be over-blocked.'],
      principle: 'Minimum Governance Required for Safe Execution'
    });
  }

  return decision({
    level: DECISION_AUTHORITY.ASK_CONFIRMATION,
    name: 'LEVEL_1_ASK_CONFIRMATION',
    ruleLayer: 'Execution Rules',
    allowed: false,
    requiresConfirmation: true,
    reasons: ['Risk or blast radius is not clear enough for autonomous execution.'],
    principle: 'Minimum Governance Required for Safe Execution'
  });
}

function hardSafetyReasons({ action, files, text, mode, diff }) {
  const reasons = [];
  if (mode === 'PRESERVATION_ONLY' && MUTATING_ACTIONS.has(action)) {
    reasons.push('Preservation mode is active; mutation is forbidden.');
  }
  if (files.some((file) => file.includes('..') || /^[a-z]:/i.test(file))) {
    reasons.push('Path scope is outside normalized repository-relative files.');
  }
  if (files.some(isForbiddenFile) || HARD_SAFETY_PATTERN.test(text)) {
    reasons.push('Hard safety boundary: secrets, privacy, database, raw data, or automatic external action.');
  }
  if (REWRITE_PATTERN.test(text) && files.some(isProtectedKeyboardPath)) {
    reasons.push('Protected keyboard rewrite is blocked.');
  }
  if (Number(diff.existingFilesChanged || diff.filesChanged || 0) > 3 || Number(diff.existingLinesChanged || diff.linesChanged || 0) > 50) {
    reasons.push('Diff exceeds autonomous execution limits.');
  }
  return reasons;
}

function isSafeLowRiskMaintenance({ action, files, text, risk, diff }) {
  if (MUTATING_ACTIONS.has(action) && files.some(isForbiddenFile)) return false;
  if (files.some(isProtectedKeyboardPath)) return false;
  if (risk && !['LOW', 'LOW_PRODUCT_RISK', 'SAFE_MAINTENANCE'].includes(risk)) return false;
  const tinyDiff = Number(diff.existingFilesChanged || diff.filesChanged || files.length || 0) <= 3 &&
    Number(diff.existingLinesChanged || diff.linesChanged || 0) <= 50;
  return tinyDiff && (SOFT_PREFERENCE_PATTERN.test(text) || files.every(isSoftFile));
}

function inferAction(input = {}) {
  const text = String(input.task || input.reason || '').toLowerCase();
  if (/screenshot|product lab/.test(text)) return 'product_lab';
  if (/scan|audit/.test(text)) return 'scan';
  if (/summar|report/.test(text)) return 'report';
  if (/commit/.test(text)) return 'commit';
  if (/delete|remove/.test(text)) return 'file_delete';
  if (/write|modify|change|fix|implement/.test(text)) return 'file_modify';
  return 'analysis';
}

function isForbiddenFile(file) {
  const normalized = String(file || '').toLowerCase();
  const base = normalized.split('/').pop() || '';
  return normalized.endsWith('google-services.json') ||
    normalized.includes('/privacy/') ||
    normalized.includes('/database/') ||
    normalized.includes('/db/') ||
    normalized.includes('/schema') ||
    normalized.includes('/migration') ||
    base.includes('secret') ||
    base.includes('token') ||
    base.includes('api-key') ||
    base.includes('apikey');
}

function isProtectedKeyboardPath(file) {
  const normalized = String(file || '').toLowerCase();
  return normalized.includes('keyboardservice.kt') ||
    normalized.includes('/swipe/') ||
    normalized.includes('/predictor/') ||
    normalized.includes('/metrics/') ||
    normalized.includes('/haptics/') ||
    normalized.includes('keyboardsizingprofile.kt') ||
    normalized.includes('keyboardsymbols.kt') ||
    normalized.includes('longpresssymbolmap.kt') ||
    normalized.includes('/res/layout/keyboard_') ||
    normalized.includes('/res/drawable/key_');
}

function isSoftFile(file) {
  return /\.(md|txt|json)$/i.test(file) || file.includes('/reports/') || file.includes('/test-');
}

function softPreferenceMatches(text) {
  const matches = [];
  if (/approval|confirm/i.test(text)) matches.push('approval preference');
  if (/architecture|modern/i.test(text)) matches.push('architecture caution');
  if (/report|summary/i.test(text)) matches.push('report-only preference');
  return matches;
}

function normalizeFiles(files) {
  return (Array.isArray(files) ? files : [files])
    .filter(Boolean)
    .map((file) => String(file).replace(/\\/g, '/').replace(/^\/+/, ''));
}

function decision(value) {
  return {
    constraints: [],
    downgradedSoftPreferences: [],
    ...value,
    framework: 'BALANCED_GOVERNANCE_V1',
    hardSafetyRules: HARD_SAFETY_RULES,
    executionRules: EXECUTION_RULES,
    softPreferences: SOFT_PREFERENCES
  };
}

function formatGovernanceFramework() {
  return [
    'GOVERNANCE FRAMEWORK: Balanced Governance v1',
    '',
    'Principle: Minimum Governance Required for Safe Execution.',
    '',
    'Rule layers:',
    '1. Hard Safety Rules: never break. Preservation, privacy, secrets, raw data, auto-send, outside-repo paths, giant protected rewrites.',
    '2. Execution Rules: must follow. One bounded task, validation, rollback, diff limits, evidence for protected areas.',
    '3. Soft Preferences: can be downgraded. Approval-by-default, report-only bias, architecture caution, no-change preference.',
    '',
    'Decision authority:',
    'Level 0: Block unsafe work.',
    'Level 1: Ask confirmation when risk/evidence is unclear.',
    'Level 2: Execute with constraints for bounded low/medium non-hard-safety work.',
    'Level 3: Fully autonomous for non-mutating work and safe operational tasks.',
    '',
    'Balance rule: if a rule slows execution without adding safety, downgrade it to a soft preference.'
  ].join('\n');
}

module.exports = {
  HARD_SAFETY_RULES,
  EXECUTION_RULES,
  SOFT_PREFERENCES,
  DECISION_AUTHORITY,
  decideGovernanceAuthority,
  formatGovernanceFramework
};
