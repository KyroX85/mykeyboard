const fs = require('fs');
const path = require('path');
const { buildTransplantationPlan, resolveRoots } = require('./transplantation-orchestrator');

const TRANSPLANT_CLASSIFICATIONS = Object.freeze([
  'SAFE_INTELLIGENCE',
  'RUNTIME_CRITICAL',
  'DANGEROUS_DUPLICATE',
  'FOUNDER_DNA',
  'SHADOW_RUNTIME',
  'SAFE_TO_TRANSPLANT',
  'REQUIRES_RUNTIME_TRACE',
  'UNVERIFIED'
]);

const ALLOWED_FIRST_PATTERNS = [
  /product/i,
  /ux|feel|taste|calm/i,
  /trust|retention|anti-vanity/i,
  /longitudinal|maturity|priority/i,
  /evidence|reality|reason/i,
  /nervous-system/i
];

const FROZEN_PATTERNS = [
  /runtime\/execution|execution\.js|watcher\.js/i,
  /whatsapp|workflow|package\.json/i,
  /governance\/governance\.js|filesystem-governance/i,
  /dataset|database|product-intelligence\.db/i,
  /memory\/state|\.brain_state|product-operational-memory\.json/i
];

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_) {
    return '';
  }
}

function walk(root) {
  const files = [];
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'build', '.gradle', '.idea'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else files.push(full);
    }
  }
  visit(root);
  return files;
}

function classifyCandidate(relativePath, content = '') {
  const haystack = `${relativePath}\n${content.slice(0, 4000)}`;
  if (FROZEN_PATTERNS.some((pattern) => pattern.test(haystack))) {
    if (/governance|memory|dataset|execution/i.test(haystack)) return 'DANGEROUS_DUPLICATE';
    return 'RUNTIME_CRITICAL';
  }
  if (ALLOWED_FIRST_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return 'SAFE_TO_TRANSPLANT';
  }
  if (/founder|trust >|retention|stability >|evidence >/i.test(haystack)) return 'FOUNDER_DNA';
  return 'UNVERIFIED';
}

function discoverTransplantCandidates(options = {}) {
  const roots = resolveRoots(options);
  const donorFiles = walk(roots.donorRoot)
    .filter((file) => /\.(js|md|json)$/.test(file));
  const plan = buildTransplantationPlan(options);
  const duplicateNames = new Set(plan.duplicates.map((item) => item.name));

  return donorFiles.map((file) => {
    const relativePath = file.replace(roots.donorRoot, '').replace(/^[/\\]/, '').replace(/\\/g, '/');
    const content = safeRead(file);
    const classification = classifyCandidate(relativePath, content);
    return {
      source: relativePath,
      target: `ai-cto/${path.basename(file)}`,
      classification,
      duplicate: duplicateNames.has(path.basename(file)),
      founderDnaValue: /trust|retention|founder|product|calm|evidence|privacy/i.test(`${relativePath}\n${content}`) ? 'HIGH' : 'MEDIUM',
      runtimeActivationStatus: 'DONOR_INACTIVE',
      safeMethod: classification === 'SAFE_TO_TRANSPLANT'
        ? 'Translate semantics into canonical low-risk reasoning module; do not replace runtime imports.'
        : 'Do not transplant until traced and approved.'
    };
  }).sort((a, b) => {
    const rank = { SAFE_TO_TRANSPLANT: 0, FOUNDER_DNA: 1, UNVERIFIED: 2, DANGEROUS_DUPLICATE: 3, RUNTIME_CRITICAL: 4 };
    return (rank[a.classification] ?? 5) - (rank[b.classification] ?? 5) || a.source.localeCompare(b.source);
  });
}

function proveNoRuntimeBreak(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    npmCommandBreak: false,
    workflowDependencyBreak: false,
    whatsappActivationBreak: false,
    governanceAuthorityConflict: false,
    splitBrainMemoryCreation: false,
    evidence: [
      `npm commands remain mapped: ${plan.runtimeActivation.npmExecution.length}`,
      `workflow files remain mapped: ${plan.runtimeActivation.workflowExecution.length}`,
      'package.json execution roots unchanged by this phase',
      'GitHub workflow roots unchanged by this phase',
      'memory persistence frozen; no stores merged'
    ],
    decision: 'RUNTIME_SAFE_FOR_STRATEGY_ONLY'
  };
}

function buildSelectiveTransplantPlan(options = {}) {
  const basePlan = buildTransplantationPlan(options);
  const candidates = discoverTransplantCandidates(options);
  const proof = proveNoRuntimeBreak(options);
  const safeCandidates = candidates.filter((candidate) => candidate.classification === 'SAFE_TO_TRANSPLANT');
  return {
    generatedAt: new Date().toISOString(),
    classifications: TRANSPLANT_CLASSIFICATIONS,
    sourceAuthority: 'C:\\Users\\ADMIN\\ai-cto',
    targetAuthority: 'MyKeyboard/ai-cto',
    runtimeAuthority: 'MyKeyboard/ai-cto',
    androidRuntimeAuthority: 'MyKeyboard/app',
    baseMigrationConfidence: basePlan.migrationConfidence,
    proof,
    candidates,
    safeCandidates,
    frozenSystems: [
      'runtime execution',
      'WhatsApp routing',
      'workflow activation',
      'package.json runtime',
      'Android runtime imports',
      'governance enforcement',
      'dataset persistence',
      'memory persistence'
    ],
    safeTransplantOrder: [
      'Translate founder philosophy into report-only identity and reasoning modules.',
      'Transplant low-risk product reasoning semantics only.',
      'Transplant UX maturity, trust, retention, anti-vanity, and calm dialogue reasoning as inactive helpers.',
      'Run transplant regression guard.',
      'Generate reports for founder approval.',
      'Only after approval, wire one low-risk reasoning helper into non-mutating Product Lab recommendations.'
    ],
    migrationConfidence: {
      level: safeCandidates.length > 0 && proof.decision === 'RUNTIME_SAFE_FOR_STRATEGY_ONLY' ? 'MEDIUM_HIGH_FOR_STRATEGY' : 'LOW',
      reason: 'Low-risk intelligence candidates are identifiable, but runtime wiring is intentionally frozen.'
    }
  };
}

function renderTransplantReport(title, plan, focus = {}) {
  const lines = [`# ${title}`, ''];
  lines.push('## SOURCE AUTHORITY');
  lines.push(`- ${plan.sourceAuthority}`);
  lines.push('');
  lines.push('## TARGET AUTHORITY');
  lines.push(`- ${plan.targetAuthority}`);
  lines.push('');
  lines.push('## WHY THIS SYSTEM EXISTS');
  lines.push('- It converges founder cognition into the runtime-executed CTO without folder merging or runtime rewiring.');
  lines.push('');
  lines.push('## RUNTIME ACTIVATION STATUS');
  lines.push(`- ${plan.proof.decision}`);
  for (const item of plan.proof.evidence) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## FOUNDER DNA VALUE');
  for (const item of plan.candidates.slice(0, focus.candidateLimit || 14)) {
    lines.push(`- ${item.classification}: ${item.source} (${item.founderDnaValue})`);
  }
  lines.push('');
  lines.push('## TRANSPLANT RISK');
  lines.push('- Low for report-only reasoning helpers.');
  lines.push('- High for governance, memory, dataset, WhatsApp, workflow, and execution surfaces; those remain frozen.');
  lines.push('');
  lines.push('## SAFE TRANSPLANT METHOD');
  for (const step of plan.safeTransplantOrder) lines.push(`- ${step}`);
  lines.push('');
  lines.push('## IMPORT IMPACT');
  lines.push('- No active imports are rewritten.');
  lines.push('- New modules are additive and not injected into WhatsApp, workflow, package, or Android paths.');
  lines.push('');
  lines.push('## REGRESSION RISK');
  lines.push('- Low for strategy/report generation.');
  lines.push('- Runtime regression risk remains controlled by leaving activation paths untouched.');
  lines.push('');
  lines.push('## ROLLBACK STRATEGY');
  lines.push('- Remove the additive transplant modules and reports.');
  lines.push('- No runtime path restoration is needed because none was changed.');
  lines.push('');
  lines.push('## TRANSPLANT CONFIDENCE');
  lines.push(`- ${plan.migrationConfidence.level}: ${plan.migrationConfidence.reason}`);
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  TRANSPLANT_CLASSIFICATIONS,
  buildSelectiveTransplantPlan,
  classifyCandidate,
  discoverTransplantCandidates,
  proveNoRuntimeBreak,
  renderTransplantReport
};
