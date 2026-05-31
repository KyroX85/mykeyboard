const fs = require('fs');
const path = require('path');
const { decideGovernanceAuthority } = require('./balanced-governance-framework');

const PRODUCT_PROTECTED_FILES = [
  'app/src/main/java/com/example/mykeyboard/KeyboardService.kt',
  'app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt',
  'app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt',
  'app/src/main/java/com/example/mykeyboard/swipe/SwipeTrailView.kt',
  'app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt',
  'app/src/main/java/com/example/mykeyboard/metrics/KeyboardMetrics.kt',
  'app/src/main/java/com/example/mykeyboard/metrics/ProductInsightEngine.kt',
  'app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt',
  'app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt',
  'app/src/main/java/com/example/mykeyboard/LongPressSymbolMap.kt',
  'app/src/main/java/com/example/mykeyboard/haptics/HapticTapGate.kt',
  'app/src/main/java/com/example/mykeyboard/haptics/HapticProfile.kt',
  'app/src/main/res/layout/keyboard_container.xml',
  'app/src/main/res/layout/key_preview.xml',
  'app/src/main/res/drawable/key_bg.xml',
  'app/src/main/res/drawable/key_bg_action.xml',
  'app/src/main/res/drawable/key_bg_modifier.xml',
  'app/src/main/res/drawable/key_bg_space.xml',
  'app/src/main/res/drawable/key_preview_bg.xml'
];

const PRODUCT_PROTECTED_PATTERNS = [
  /^app\/src\/main\/java\/com\/example\/mykeyboard\/swipe\//,
  /^app\/src\/main\/java\/com\/example\/mykeyboard\/predictor\//,
  /^app\/src\/main\/java\/com\/example\/mykeyboard\/metrics\//,
  /^app\/src\/main\/java\/com\/example\/mykeyboard\/haptics\//,
  /^app\/src\/main\/res\/layout\/keyboard_/,
  /^app\/src\/main\/res\/drawable\/key_/
];

const PRIORITY_ORDER = [
  'product trust',
  'runtime stability',
  'typing confidence',
  'swipe reliability',
  'UX consistency',
  'real-device evidence',
  'safety + rollback',
  'maintainability',
  'operational automation',
  'cosmetic cleanup'
];

const TRUST_FILE = path.join(__dirname, 'agent-trust-score.json');
const REGRESSION_MEMORY_FILE = path.join(__dirname, 'product-regression-memory.json');
const ROADMAP_LOCK_FILE = path.join(__dirname, 'roadmap-lock.json');
const PRODUCT_EVIDENCE_FILE = path.join(__dirname, 'product-evidence-archive.json');
const PRODUCT_WISDOM_FILE = path.join(__dirname, 'product-wisdom-memory.json');

const DRIFT_SIGNALS = [
  'complexity',
  'module sprawl',
  'duplicate governance',
  'wrapper proliferation',
  'memory duplication',
  'report inflation',
  'feature creep',
  'cosmetic churn',
  'smart sounding useless work',
  'architecture expansion without UX gain'
];

const PRODUCT_EVIDENCE_KEYS = [
  'correctionLoad',
  'swipeStability',
  'symbolFriction',
  'modeSwitchFriction',
  'responsiveness',
  'edgeKeyConfidence'
];

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isProductProtectedFile(file) {
  const normalized = normalizePath(file);
  const lower = normalized.toLowerCase();
  return PRODUCT_PROTECTED_FILES.some((protectedFile) => protectedFile.toLowerCase() === lower) ||
    PRODUCT_PROTECTED_PATTERNS.some((pattern) => pattern.test(lower));
}

function protectedFilesIn(files) {
  return array(files).map(normalizePath).filter(isProductProtectedFile);
}

function classifyProductChange({ files = [], task = '', changes = [], diff = null } = {}) {
  const normalizedFiles = array(files).map(normalizePath).filter(Boolean);
  const text = `${task} ${array(changes).join(' ')} ${normalizedFiles.join(' ')}`.toLowerCase();
  const categories = new Set();
  const protectedFiles = protectedFilesIn(normalizedFiles);
  const reasons = [];
  const productAreas = new Set();

  if (protectedFiles.length) {
    categories.add('MEDIUM_PRODUCT_RISK');
    reasons.push('Touches protected keyboard product/runtime files.');
  }
  if (/\b(swipe|gesture|trail|resolver|long[- ]?word)\b/.test(text)) {
    categories.add('SWIPE_RISK');
    productAreas.add('swipe reliability');
    reasons.push('Swipe changes can regress gesture trust and long-word input.');
  }
  if (/\bpredict|suggest|autocorrect|correction|ranking\b/.test(text)) {
    categories.add('PREDICTION_RISK');
    productAreas.add('typing confidence');
    reasons.push('Prediction changes can increase corrections or wrong suggestions.');
  }
  if (/\bkeyboardservice|lifecycle|inputconnection|ime|touch|haptic|latency|runtime\b/.test(text)) {
    categories.add('RUNTIME_RISK');
    productAreas.add('runtime stability');
    reasons.push('Runtime/hot-path changes can affect responsiveness and crash risk.');
  }
  if (/\blayout|spacing|size|geometry|key_bg|symbol|emoji|visual|theme\b/.test(text)) {
    categories.add('UX_RISK');
    productAreas.add('UX consistency');
    reasons.push('Layout or geometry changes can weaken touch confidence and visual hierarchy.');
  }
  if (/\barchitecture|refactor|extract|rewrite|module|dependency|gradle|workflow\b/.test(text)) {
    categories.add('ARCHITECTURE_RISK');
    reasons.push('Architecture or dependency changes increase blast radius.');
  }
  if (!categories.size && isSafeMaintenanceText(text, normalizedFiles)) {
    categories.add('SAFE_MAINTENANCE');
    reasons.push('Scope appears limited to docs, tests, reports, or tiny maintenance.');
  }
  if (!categories.size) {
    categories.add('LOW_PRODUCT_RISK');
    reasons.push('No protected hot path detected, but product impact is not fully verified.');
  }
  if (diff && Number(diff.existingLinesChanged || diff.linesChanged || 0) > 50) {
    categories.add('ARCHITECTURE_RISK');
    reasons.push('Diff is large enough to require founder review.');
  }

  return {
    categories: [...categories],
    primaryCategory: highestCategory(categories),
    protectedFiles,
    productAreas: [...productAreas],
    riskExistsBecause: reasons,
    mayRegress: regressionTargets(categories),
    missingEvidence: missingEvidenceFor(categories),
    roadmapAlignment: roadmapAlignmentFor(categories, text),
    perceptibility: perceptibilityFor(categories)
  };
}

function shouldBlockDirectProductExecution({ files = [], task = '', changes = [], diff = null, evidence = {}, validation = {}, action = 'file_modify', governanceMode = '' } = {}) {
  const classification = classifyProductChange({ files, task, changes, diff });
  const authority = decideGovernanceAuthority({
    files,
    task,
    changes,
    diff,
    evidence,
    validation,
    action,
    governanceMode,
    riskLevel: classification.primaryCategory
  });
  return {
    blocked: authority.level <= 1,
    classification,
    authority,
    decisionLevel: authority.level,
    decisionName: authority.name,
    requiresConfirmation: authority.requiresConfirmation
  };
}

function buildRealityValidationGate({ root = process.cwd(), files = [], diff = null, validation = {} } = {}) {
  const classification = classifyProductChange({ files, diff });
  const forbiddenTouched = array(files).filter(isForbiddenGovernanceFile);
  const giantDiff = diff && (
    Number(diff.existingFilesChanged || diff.filesChanged || 0) > 3 ||
    Number(diff.existingLinesChanged || diff.linesChanged || 0) > 50
  );
  const checks = [
    check('build passed', validation.buildPassed === true, 'Build has not been verified in this request.'),
    check('tests passed', validation.testsPassed === true, 'Tests have not been verified in this request.'),
    check('lint passed', validation.lintPassed === true, 'Lint has not been verified in this request.'),
    check('no forbidden files touched', forbiddenTouched.length === 0, forbiddenTouched.join(', ') || null),
    check('no giant diffs', !giantDiff, giantDiff ? 'Diff exceeds product governance size limit.' : null),
    check('no duplicate architecture', !classification.categories.includes('ARCHITECTURE_RISK'), 'Architecture risk requires review.'),
    check('no fake progress', !isFakeProgress(files), 'Change appears report/log heavy without product evidence.'),
    check('no unnecessary abstractions', !classification.categories.includes('ARCHITECTURE_RISK'), 'Abstraction/refactor risk detected.')
  ];
  return {
    passed: checks.every((item) => item.passed),
    checks,
    classification,
    realDeviceEvidence: hasRealDeviceEvidence(root),
    realDeviceEvidenceStatement: hasRealDeviceEvidence(root) ? 'REAL-DEVICE EVIDENCE PRESENT' : 'NO REAL-DEVICE EVIDENCE YET'
  };
}

function formatGovernanceBlock({ task = 'requested change', files = [], classification = null } = {}) {
  const risk = classification || classifyProductChange({ files, task });
  return [
    'CTO: Founder, this touches protected product behavior.',
    'Direct WhatsApp execution is blocked.',
    `Task: ${task}`,
    `Risk: ${risk.primaryCategory}`,
    `Files: ${array(files).slice(0, 4).join(', ') || 'not identified'}`,
    `May regress: ${risk.mayRegress.join(', ') || 'product trust'}`,
    'Evidence: NO REAL-DEVICE EVIDENCE YET',
    'Options:',
    '1. Create a review-only plan',
    '2. Create a staging branch proposal after validation',
    '3. Cancel'
  ].join('\n');
}

function readRoadmapLock(root = path.dirname(__dirname)) {
  return readJson(path.join(root, 'ai-cto', 'roadmap-lock.json'), defaultRoadmapLock());
}

function evaluateRoadmapAlignment({ root = path.dirname(__dirname), proposal = '', files = [], expectedUxGain = '' } = {}) {
  const lock = readRoadmapLock(root);
  const text = `${proposal} ${expectedUxGain} ${array(files).join(' ')}`.toLowerCase();
  const conflicts = [];
  const matchedAntiGoals = lock.antiGoals.filter((item) => textIncludesLoose(text, item));
  const matchedRejected = lock.rejectedDirections.filter((item) => textIncludesLoose(text, item));
  const matchedNeverAgain = lock.neverDoAgainPatterns.filter((item) => textIncludesLoose(text, item));

  if (matchedAntiGoals.length) conflicts.push(`anti-goal: ${matchedAntiGoals[0]}`);
  if (matchedRejected.length) conflicts.push(`rejected direction: ${matchedRejected[0]}`);
  if (matchedNeverAgain.length) conflicts.push(`never-do-again: ${matchedNeverAgain[0]}`);
  if (/\b(companion personality|lstm|cloud ai in live typing|emotional fingerprint|public launch|telemetry expansion)\b/.test(text)) {
    conflicts.push('conflicts with protected foundation and Phase 2 Explain focus');
  }
  if (/\b(rewrite|redesign|architecture|framework|dependency upgrade)\b/.test(text) && !hasUxGain(expectedUxGain)) {
    conflicts.push('architecture or redesign without measurable UX gain');
  }

  return {
    allowed: conflicts.length === 0,
    decision: conflicts.length ? 'BLOCK' : 'ALLOW_PROPOSAL_ONLY',
    conflicts,
    phase: lock.currentPhase,
    philosophy: lock.productPhilosophy,
    uxPriorities: lock.uxPriorities
  };
}

function detectProductDrift({ root = path.dirname(__dirname), files = [], actions = [], reports = [], modules = [] } = {}) {
  const combined = `${array(files).join(' ')} ${array(actions).map((item) => item.action || item.summary || item).join(' ')} ${array(reports).join(' ')} ${array(modules).join(' ')}`.toLowerCase();
  const detected = DRIFT_SIGNALS.filter((signal) => textIncludesLoose(combined, signal));
  const reportHeavy = array(files).filter((file) => /\.(md|log|json)$/i.test(normalizePath(file))).length >= 3 &&
    !array(files).some((file) => normalizePath(file).includes('app/src/main/'));
  if (reportHeavy) detected.push('report inflation');
  const duplicateGovernance = array(modules).filter((item) => /governance|memory|trust|policy/i.test(String(item))).length >= 3;
  if (duplicateGovernance) detected.push('duplicate governance systems');
  const score = clamp(detected.length * 15, 0, 100);

  return {
    score,
    level: score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW',
    detected: [...new Set(detected)],
    autonomyAdjustment: score >= 60 ? 'REDUCE_TO_PRESERVATION_ONLY' : score >= 30 ? 'REQUIRE_FOUNDER_REVIEW' : 'NO_CHANGE'
  };
}

function computeAutonomyPosture({
  daysSinceFounderFeedback = 0,
  realDeviceEvidence = false,
  successfulProductValidations = 0,
  stabilityIndex = 70,
  driftScore = 0
} = {}) {
  let level = 'LOW_RISK_MAINTENANCE_ONLY';
  const reductions = [];

  if (daysSinceFounderFeedback >= 14) reductions.push('founder feedback stale');
  if (!realDeviceEvidence) reductions.push('no real-device evidence');
  if (successfulProductValidations <= 0) reductions.push('no successful product validation');
  if (stabilityIndex < 60) reductions.push('stability index below 60');
  if (driftScore >= 30) reductions.push('product drift detected');

  if (daysSinceFounderFeedback >= 30 || stabilityIndex < 45 || driftScore >= 60) {
    level = 'PRESERVATION_ONLY';
  } else if (reductions.length >= 2) {
    level = 'ANALYSIS_AND_PROPOSALS_ONLY';
  }

  return {
    level,
    reductions,
    allowed: allowedForAutonomyLevel(level)
  };
}

function archiveProductEvidence({ root = path.dirname(__dirname), snapshot = {}, source = 'aggregate' } = {}) {
  const file = path.join(root, 'ai-cto', 'product-evidence-archive.json');
  const archive = readProductEvidenceArchive(root);
  const entry = {
    timestamp: new Date().toISOString(),
    source: String(source || 'aggregate').slice(0, 80),
    metrics: sanitizeAggregateEvidence(snapshot)
  };
  archive.entries = [...array(archive.entries), entry].slice(-370);
  archive.trends = compareEvidenceTrend(archive.entries);
  writeJson(file, archive);
  return archive;
}

function readProductEvidenceArchive(root = path.dirname(__dirname)) {
  return readJson(path.join(root, 'ai-cto', 'product-evidence-archive.json'), defaultProductEvidenceArchive());
}

function compareEvidenceTrend(entries = []) {
  const normalized = array(entries);
  const split = Math.max(1, Math.floor(normalized.length / 2));
  const previous = normalized.length >= 14 ? normalized.slice(-14, -7) : normalized.slice(0, split);
  const recent = normalized.length >= 14 ? normalized.slice(-7) : normalized.slice(split);
  const trends = {};
  for (const key of PRODUCT_EVIDENCE_KEYS) {
    const recentAverage = averageMetric(recent, key);
    const previousAverage = averageMetric(previous, key);
    trends[key] = {
      recentAverage,
      previousAverage,
      direction: trendDirection(key, recentAverage, previousAverage)
    };
  }
  return trends;
}

function createTrustedExperiment({
  title,
  expectedUxGain,
  expectedRisk,
  rollbackSimplicity,
  affectedTrustScores = [],
  affectedSubsystems = [],
  confidenceLevel = 'LOW',
  evidenceSource = 'not verified',
  createdAt = new Date().toISOString(),
  expiresInDays = 14
} = {}) {
  const missing = [];
  if (!title) missing.push('title');
  if (!expectedUxGain) missing.push('expected UX gain');
  if (!expectedRisk) missing.push('expected risk');
  if (!rollbackSimplicity) missing.push('rollback simplicity');
  if (!array(affectedSubsystems).length) missing.push('affected subsystems');
  if (!evidenceSource || evidenceSource === 'not verified') missing.push('evidence source');

  return {
    ok: missing.length === 0,
    status: missing.length ? 'INCOMPLETE' : 'PROPOSAL_ONLY',
    missing,
    experiment: {
      title: String(title || '').slice(0, 160),
      expectedUxGain: String(expectedUxGain || '').slice(0, 260),
      expectedRisk: String(expectedRisk || '').slice(0, 160),
      rollbackSimplicity: String(rollbackSimplicity || '').slice(0, 160),
      affectedTrustScores: array(affectedTrustScores).slice(0, 8),
      affectedSubsystems: array(affectedSubsystems).slice(0, 8),
      confidenceLevel,
      evidenceSource,
      createdAt,
      expiresAt: addDaysIso(createdAt, expiresInDays)
    }
  };
}

function expireTrustedExperiments(experiments = [], now = new Date().toISOString()) {
  return array(experiments).map((experiment) => {
    const expired = Date.parse(experiment.expiresAt || now) <= Date.parse(now);
    const validationMissing = !experiment.validation || experiment.validation.improved !== true;
    const rollbackRising = Number(experiment.rollbackCount || 0) > 0;
    if (expired || validationMissing || rollbackRising) {
      return {
        ...experiment,
        status: 'EXPIRED',
        expiredReason: rollbackRising ? 'rollback frequency rose' : validationMissing ? 'no validation improvement' : 'time expired'
      };
    }
    return experiment;
  });
}

function computeProductStabilityIndex({
  regressions = 0,
  rollbackFrequency = 0,
  correctionLoad = 0,
  swipeInstability = 0,
  runtimeInstability = 0,
  unresolvedFriction = 0,
  fakeProgressRate = 0,
  trustScoreTrend = 0
} = {}) {
  const penalty =
    Number(regressions) * 10 +
    Number(rollbackFrequency) * 12 +
    Number(correctionLoad) * 0.6 +
    Number(swipeInstability) * 0.8 +
    Number(runtimeInstability) * 1.1 +
    Number(unresolvedFriction) * 7 +
    Number(fakeProgressRate) * 0.7 +
    Math.max(0, -Number(trustScoreTrend)) * 0.8;
  const score = clamp(Math.round(100 - penalty), 0, 100);
  return {
    score,
    band: score >= 80 ? 'STABLE' : score >= 60 ? 'WATCH' : score >= 40 ? 'RESTRICTED' : 'PRESERVATION_ONLY',
    autonomyAdjustment: score < 40 ? 'PRESERVATION_ONLY' : score < 60 ? 'ANALYSIS_AND_PROPOSALS_ONLY' : 'NO_INCREASE'
  };
}

function founderAbsenceMode({ daysSinceFounderFeedback = 0, stabilityIndex = 70, driftScore = 0 } = {}) {
  const active = daysSinceFounderFeedback >= 7;
  if (!active) {
    return {
      active: false,
      priorities: ['normal bounded maintenance', 'founder-directed work'],
      blocked: []
    };
  }
  const posture = computeAutonomyPosture({ daysSinceFounderFeedback, stabilityIndex, driftScore });
  return {
    active: true,
    posture: posture.level,
    priorities: ['preservation', 'maintenance', 'evidence collection', 'regression prevention', 'roadmap protection'],
    blocked: ['expansion', 'redesign', 'experimentation', 'architecture growth', 'product hot-path edits']
  };
}

function readProductWisdom(root = path.dirname(__dirname)) {
  return readJson(path.join(root, 'ai-cto', 'product-wisdom-memory.json'), defaultProductWisdom());
}

function recordProductWisdom({ root = path.dirname(__dirname), type = 'improved_trust', summary = '', evidence = '', files = [] } = {}) {
  const file = path.join(root, 'ai-cto', 'product-wisdom-memory.json');
  const wisdom = readProductWisdom(root);
  const key = wisdomKey(type);
  wisdom[key] = [
    ...array(wisdom[key]),
    {
      timestamp: new Date().toISOString(),
      summary: String(summary || '').slice(0, 240),
      evidence: String(evidence || '').slice(0, 240),
      files: array(files).map(normalizePath).slice(0, 8)
    }
  ].slice(-80);
  writeJson(file, wisdom);
  return wisdom;
}

function buildHumanReturnRecovery({ since = '', changes = [], blocked = [], postponed = [], risks = [], trends = {}, trustScores = {} } = {}) {
  return {
    since,
    whatChanged: array(changes).slice(0, 20),
    whatStabilized: array(changes).filter((item) => /stable|passed|reduced|fixed/i.test(String(item))).slice(0, 10),
    whatDegraded: array(risks).filter((item) => /degrad|failed|worse|regress|unstable/i.test(String(item))).slice(0, 10),
    whatWasBlocked: array(blocked).slice(0, 20),
    proposalsPostponed: array(postponed).slice(0, 20),
    risksAccumulated: array(risks).slice(0, 20),
    trustScoresChanged: trustScores,
    evidenceTrends: trends,
    style: 'operational truth only'
  };
}

function readTrustScore(root = path.dirname(__dirname)) {
  const file = path.join(root, 'ai-cto', 'agent-trust-score.json');
  return readJson(file, {
    version: '1.0',
    agents: {
      CTO: defaultTrust('CTO'),
      Coder: defaultTrust('Coder'),
      Reviewer: defaultTrust('Reviewer'),
      Auditor: defaultTrust('Auditor')
    }
  });
}

function recordTrustEvent({ root = path.dirname(__dirname), agent = 'CTO', event, delta = 0, reason = '', evidence = '' } = {}) {
  const file = path.join(root, 'ai-cto', 'agent-trust-score.json');
  const current = readTrustScore(root);
  const existing = current.agents[agent] || defaultTrust(agent);
  const score = clamp((existing.score == null ? 70 : existing.score) + Number(delta || 0), 0, 100);
  current.agents[agent] = {
    ...existing,
    score,
    lastUpdatedAt: new Date().toISOString(),
    events: [
      ...(Array.isArray(existing.events) ? existing.events : []),
      {
        timestamp: new Date().toISOString(),
        event: String(event || 'trust event'),
        delta: Number(delta || 0),
        reason: String(reason || '').slice(0, 240),
        evidence: String(evidence || '').slice(0, 240)
      }
    ].slice(-80)
  };
  writeJson(file, current);
  return current.agents[agent];
}

function readRegressionMemory(root = path.dirname(__dirname)) {
  return readJson(path.join(root, 'ai-cto', 'product-regression-memory.json'), defaultRegressionMemory());
}

function recordRegressionMemory({ root = path.dirname(__dirname), type, summary, files = [], avoidedBy = '' } = {}) {
  const file = path.join(root, 'ai-cto', 'product-regression-memory.json');
  const current = readRegressionMemory(root);
  const key = regressionKey(type);
  const list = Array.isArray(current[key]) ? current[key] : [];
  current[key] = [
    ...list,
    {
      timestamp: new Date().toISOString(),
      summary: String(summary || '').slice(0, 260),
      files: array(files).map(normalizePath).slice(0, 8),
      avoidedBy: String(avoidedBy || '').slice(0, 180)
    }
  ].slice(-80);
  writeJson(file, current);
  return current;
}

function isForbiddenGovernanceFile(file) {
  const normalized = normalizePath(file).toLowerCase();
  const basename = normalized.split('/').pop() || '';
  return normalized.endsWith('google-services.json') ||
    normalized.includes('/privacy/') ||
    normalized.includes('databasehelper.kt') ||
    normalized.includes('/database/') ||
    normalized.includes('/db/') ||
    basename.includes('secret') ||
    basename.includes('key');
}

function isSafeMaintenanceText(text, files) {
  if (files.some(isProductProtectedFile)) return false;
  return /\b(doc|docs|readme|report|test file|comment|newline|format|whitespace|log)\b/.test(text);
}

function highestCategory(categories) {
  const order = [
    'HIGH_PRODUCT_RISK',
    'ARCHITECTURE_RISK',
    'RUNTIME_RISK',
    'SWIPE_RISK',
    'PREDICTION_RISK',
    'UX_RISK',
    'MEDIUM_PRODUCT_RISK',
    'LOW_PRODUCT_RISK',
    'SAFE_MAINTENANCE'
  ];
  return order.find((category) => categories.has(category)) || 'LOW_PRODUCT_RISK';
}

function regressionTargets(categories) {
  const targets = new Set();
  if (categories.has('SWIPE_RISK')) targets.add('swipe trust');
  if (categories.has('PREDICTION_RISK')) targets.add('typing confidence');
  if (categories.has('RUNTIME_RISK')) targets.add('keypress responsiveness or crashes');
  if (categories.has('UX_RISK')) targets.add('touch accuracy or visual hierarchy');
  if (categories.has('ARCHITECTURE_RISK')) targets.add('maintainability and regression isolation');
  if (!targets.size && categories.has('LOW_PRODUCT_RISK')) targets.add('minor product consistency');
  return [...targets];
}

function missingEvidenceFor(categories) {
  const missing = ['real-device typing session evidence', 'before/after validation'];
  if (categories.has('SWIPE_RISK')) missing.push('swipe success and long-word failure sample data');
  if (categories.has('PREDICTION_RISK')) missing.push('correction rate and suggestion acceptance evidence');
  if (categories.has('RUNTIME_RISK')) missing.push('latency, frame hitch, and crash evidence');
  if (categories.has('UX_RISK')) missing.push('device-size screenshot/touch evidence');
  return missing;
}

function roadmapAlignmentFor(categories, text) {
  if (categories.has('SAFE_MAINTENANCE')) return 'Supports stability only if it reduces future operational friction.';
  if (categories.has('SWIPE_RISK')) return 'Foundation-protected area: relevant only when evidence shows swipe trust or typing confidence improves.';
  if (categories.has('PREDICTION_RISK')) return 'Foundation-protected area: relevant only when correction rate or typing confidence evidence improves.';
  if (/\bcompanion|lstm|emotional|fingerprint|cloud|ai learning\b/.test(text)) {
    return 'Conflicts with protected foundation and Phase 2 Explain focus unless founder explicitly approves.';
  }
  return 'Must prove stability, typing confidence, or UX consistency before implementation.';
}

function perceptibilityFor(categories) {
  if (categories.has('SAFE_MAINTENANCE')) return 'Usually not perceptible to users.';
  if (categories.has('SWIPE_RISK') || categories.has('PREDICTION_RISK') || categories.has('RUNTIME_RISK') || categories.has('UX_RISK')) {
    return 'Potentially perceptible, but not verified without real-device evidence.';
  }
  return 'Perceptibility unknown.';
}

function hasRealDeviceEvidence(root) {
  const candidates = [
    path.join(root, 'ai-cto', 'real-device-evidence.json'),
    path.join(root, 'REAL_DEVICE_EVIDENCE.md')
  ];
  return candidates.some((file) => fs.existsSync(file) && fs.statSync(file).size > 20);
}

function isFakeProgress(files) {
  const normalized = array(files).map(normalizePath);
  if (!normalized.length) return false;
  return normalized.every((file) =>
    file.endsWith('.md') ||
    file.includes('report') ||
    file.includes('agent-action-log') ||
    file.includes('founder-memory') ||
    file.endsWith('.log')
  );
}

function defaultTrust(agent) {
  return {
    agent,
    score: 70,
    lastUpdatedAt: null,
    events: []
  };
}

function defaultRegressionMemory() {
  return {
    version: '1.0',
    regressions_introduced_before: [],
    founder_rejected_patterns: [],
    dangerous_architectural_ideas: [],
    ux_mistakes: [],
    swipe_failures: [],
    bad_symbol_layout_decisions: [],
    fake_optimization_attempts: [],
    overengineering_incidents: []
  };
}

function defaultRoadmapLock() {
  return {
    version: '2.0',
    founderVision: 'Aritenis must protect the mature keyboard foundation while building Explain as the Phase 2 differentiator.',
    currentPhase: 'Phase 1 Protected Foundation + Phase 2 Explain Active',
    productPhilosophy: [
      'Phase 1 foundation is protected',
      'Phase 2 Explain is active for design, proposals, and Product Lab evidence',
      'typing trust, swipe trust, prediction trust, and stability must not degrade',
      'implementation touching hot paths requires founder approval',
      'understanding before typing'
    ],
    uxPriorities: [
      'Explain confusing screenshots',
      'Explain messages, bills, notices, forms, errors, posts, and documents',
      'Glass handle execution-layer access',
      'Ready / Confirm / Cancel action safety',
      'Screenshot understanding before draft/reply',
      'Foundation regression monitoring'
    ],
    antiGoals: [
      'AI theater',
      'architecture expansion without UX gain',
      'feature count over completed actions',
      'foundation churn without evidence',
      'silent screenshot reading',
      'screenshot retention forever',
      'autonomous sending',
      'cloud AI in live typing hot path'
    ],
    rejectedDirections: [
      'uncontrolled swipe rewrites',
      'predictor rewrites without correction evidence',
      'companion personality before Explain reliability',
      'theme engines as Phase 2 differentiation',
      'internet-learning loops'
    ],
    neverDoAgainPatterns: [
      'treat reports as product progress',
      'directly edit protected keyboard hot paths from chat',
      'claim improvement without real-device evidence',
      'increase autonomy while founder feedback is stale',
      'route product questions into ENGINEERING_REPORT commits'
    ]
  };
}

function defaultProductEvidenceArchive() {
  return {
    version: '1.0',
    privacy: 'aggregate metrics only; no raw text, no sentences, no keystroke history',
    entries: [],
    trends: {}
  };
}

function defaultProductWisdom() {
  return {
    version: '1.0',
    improved_trust: [],
    caused_pain: [],
    founder_praised: [],
    founder_rejected: [],
    repeatedly_failed_experiments: []
  };
}

function sanitizeAggregateEvidence(snapshot) {
  const output = {};
  for (const key of PRODUCT_EVIDENCE_KEYS) {
    if (snapshot[key] != null && Number.isFinite(Number(snapshot[key]))) {
      output[key] = Number(snapshot[key]);
    }
  }
  return output;
}

function averageMetric(entries, key) {
  const values = array(entries)
    .map((entry) => Number(entry.metrics && entry.metrics[key]))
    .filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function trendDirection(key, recent, previous) {
  if (recent == null || previous == null) return 'UNKNOWN';
  if (recent === previous) return 'FLAT';
  const higherIsBetter = key === 'swipeStability' || key === 'responsiveness' || key === 'edgeKeyConfidence';
  const improved = higherIsBetter ? recent > previous : recent < previous;
  return improved ? 'IMPROVING' : 'DEGRADING';
}

function allowedForAutonomyLevel(level) {
  if (level === 'PRESERVATION_ONLY') {
    return ['analyze', 'summarize', 'collect aggregate evidence', 'block drift'];
  }
  if (level === 'ANALYSIS_AND_PROPOSALS_ONLY') {
    return ['analyze', 'summarize', 'prepare proposals', 'prepare tests', 'prepare rollback plans'];
  }
  return ['analyze', 'summarize', 'safe maintenance proposals', 'tests', 'rollout plans'];
}

function hasUxGain(text) {
  return /\b(typing|swipe|symbol|spacebar|responsiveness|touch|rhythm|runtime|friction|trust|clarity)\b/i.test(String(text || ''));
}

function textIncludesLoose(text, phrase) {
  const normalized = String(phrase || '').toLowerCase();
  if (!normalized) return false;
  if (text.includes(normalized)) return true;
  return normalized.split(/\s+/).filter(Boolean).every((part) => text.includes(part));
}

function addDaysIso(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString();
}

function wisdomKey(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('pain')) return 'caused_pain';
  if (normalized.includes('praise')) return 'founder_praised';
  if (normalized.includes('reject')) return 'founder_rejected';
  if (normalized.includes('fail')) return 'repeatedly_failed_experiments';
  return 'improved_trust';
}

function regressionKey(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('founder')) return 'founder_rejected_patterns';
  if (normalized.includes('architecture')) return 'dangerous_architectural_ideas';
  if (normalized.includes('ux')) return 'ux_mistakes';
  if (normalized.includes('swipe')) return 'swipe_failures';
  if (normalized.includes('symbol')) return 'bad_symbol_layout_decisions';
  if (normalized.includes('fake')) return 'fake_optimization_attempts';
  if (normalized.includes('over')) return 'overengineering_incidents';
  return 'regressions_introduced_before';
}

function check(name, passed, detail = null) {
  return { name, passed: Boolean(passed), detail };
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function array(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  PRODUCT_PROTECTED_FILES,
  PRODUCT_PROTECTED_PATTERNS,
  PRIORITY_ORDER,
  classifyProductChange,
  isProductProtectedFile,
  protectedFilesIn,
  shouldBlockDirectProductExecution,
  decideGovernanceAuthority,
  buildRealityValidationGate,
  formatGovernanceBlock,
  readRoadmapLock,
  evaluateRoadmapAlignment,
  detectProductDrift,
  computeAutonomyPosture,
  archiveProductEvidence,
  readProductEvidenceArchive,
  compareEvidenceTrend,
  createTrustedExperiment,
  expireTrustedExperiments,
  computeProductStabilityIndex,
  founderAbsenceMode,
  readProductWisdom,
  recordProductWisdom,
  buildHumanReturnRecovery,
  readTrustScore,
  recordTrustEvent,
  readRegressionMemory,
  recordRegressionMemory,
  isForbiddenGovernanceFile
};
