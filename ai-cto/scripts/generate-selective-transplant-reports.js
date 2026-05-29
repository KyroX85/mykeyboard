const fs = require('fs');
const path = require('path');
const { buildSelectiveTransplantPlan, renderTransplantReport } = require('../intelligence-transplant-engine');
const { translateFounderDna } = require('../founder-dna-translator');
const { verifyRuntimeSafeImports } = require('../runtime-safe-import-engine');
const { preventDuplicateRuntime } = require('../duplicate-runtime-preventer');
const { planSingleBrainConvergence } = require('../single-brain-convergence-engine');
const { planShadowGovernanceElimination } = require('../shadow-governance-eliminator');
const { planMemoryConvergence } = require('../memory-convergence-engine');
const { lockCanonicalRuntime } = require('../canonical-runtime-lock');
const { guardTransplantRegression } = require('../transplant-regression-guard');
const { buildOperationalIdentity } = require('../operational-identity-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const plan = buildSelectiveTransplantPlan({ productRoot: ROOT });

function section(title, content) {
  return `\n## ${title}\n${content}\n`;
}

function bullets(items, mapper = (item) => String(item)) {
  if (!items || items.length === 0) return '- None discovered in this pass.\n';
  return items.map((item) => `- ${mapper(item)}`).join('\n') + '\n';
}

const dna = translateFounderDna({ productRoot: ROOT });
const imports = verifyRuntimeSafeImports({ productRoot: ROOT });
const duplicateRuntime = preventDuplicateRuntime({ productRoot: ROOT });
const convergence = planSingleBrainConvergence({ productRoot: ROOT });
const shadowGovernance = planShadowGovernanceElimination({ productRoot: ROOT });
const memory = planMemoryConvergence({ productRoot: ROOT });
const runtimeLock = lockCanonicalRuntime({ productRoot: ROOT });
const regression = guardTransplantRegression({ productRoot: ROOT });
const identity = buildOperationalIdentity();

const reports = {
  'SAFE_INTELLIGENCE_TRANSPLANT_REPORT.md': renderTransplantReport(
    'Safe Intelligence Transplant Report',
    plan,
    { candidateLimit: 30 }
  ) + section('SAFE CANDIDATES', bullets(plan.safeCandidates.slice(0, 40), (item) => `${item.source} -> ${item.safeMethod}`)),
  'FOUNDER_DNA_TRANSPLANT_MAP.md': renderTransplantReport(
    'Founder DNA Transplant Map',
    plan,
    { candidateLimit: 35 }
  ) + section('TRANSLATED PRINCIPLES', bullets(dna.translatedPrinciples)),
  'RUNTIME_SAFE_TRANSPLANT_REPORT.md': renderTransplantReport(
    'Runtime Safe Transplant Report',
    plan
  ) + section('IMPORT SAFETY', bullets([imports.decision, imports.importImpact])),
  'DUPLICATE_RUNTIME_PREVENTION_REPORT.md': renderTransplantReport(
    'Duplicate Runtime Prevention Report',
    plan
  ) + section('DANGEROUS RUNTIME CANDIDATES', bullets(duplicateRuntime.dangerousCandidates.slice(0, 40), (item) => `${item.classification}: ${item.source}`)),
  'SINGLE_BRAIN_CONVERGENCE_REPORT.md': renderTransplantReport(
    'Single Brain Convergence Report',
    plan
  ) + section('CONVERGENCE DECISION', bullets([convergence.decision, `Frozen systems: ${convergence.frozenSystems.join(', ')}`])),
  'SHADOW_GOVERNANCE_ELIMINATION_REPORT.md': renderTransplantReport(
    'Shadow Governance Elimination Report',
    plan
  ) + section('SHADOW GOVERNANCE', bullets(shadowGovernance.shadowGovernance.slice(0, 40), (item) => `${item.classification}: ${item.source}`)),
  'MEMORY_CONVERGENCE_REPORT.md': renderTransplantReport(
    'Memory Convergence Report',
    plan
  ) + section('MEMORY DECISION', bullets([memory.decision, memory.safeMethod, memory.splitBrainRisk])),
  'CANONICAL_RUNTIME_LOCK_REPORT.md': renderTransplantReport(
    'Canonical Runtime Lock Report',
    plan
  ) + section('LOCKS', bullets([
    `Runtime: ${runtimeLock.lock}`,
    `Android: ${runtimeLock.androidRuntimeLock}`,
    `package.json: ${runtimeLock.packageJsonLock}`,
    `workflows: ${runtimeLock.workflowLock}`,
    `WhatsApp: ${runtimeLock.whatsappLock}`
  ])),
  'TRANSPLANT_REGRESSION_REPORT.md': renderTransplantReport(
    'Transplant Regression Report',
    plan
  ) + section('REGRESSION GUARD', bullets([regression.decision, regression.rollbackStrategy])),
  'OPERATIONAL_IDENTITY_REPORT.md': renderTransplantReport(
    'Operational Identity Report',
    plan
  ) + section('CANONICAL IDENTITY', bullets([identity.identity, ...identity.principles])) +
      section('FORBIDDEN DRIFT', bullets(identity.forbiddenDrift))
};

for (const [name, content] of Object.entries(reports)) {
  fs.writeFileSync(path.join(ROOT, name), content);
}

console.log(`Generated ${Object.keys(reports).length} selective transplant reports`);
