const fs = require('fs');
const path = require('path');
const { buildTransplantationPlan, traceImports } = require('./transplantation-orchestrator');
const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');
const { buildOperationalIdentity } = require('./operational-identity-engine');

const CONVERGENCE_PHASES = Object.freeze([
  'INTELLIGENCE_CONVERGENCE',
  'MEMORY_CONVERGENCE',
  'DATASET_CONVERGENCE',
  'GOVERNANCE_CONVERGENCE',
  'SHADOW_RETIREMENT'
]);

function exists(target) {
  try {
    return fs.existsSync(target);
  } catch (_) {
    return false;
  }
}

function readJson(target) {
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (_) {
    return null;
  }
}

function listWorkflowReferences(productRoot) {
  const workflowRoot = path.join(productRoot, '.github', 'workflows');
  if (!exists(workflowRoot)) return [];
  return fs.readdirSync(workflowRoot)
    .filter((name) => /\.(yml|yaml)$/.test(name))
    .map((name) => {
      const file = path.join(workflowRoot, name);
      const content = fs.readFileSync(file, 'utf8');
      return {
        file: path.relative(productRoot, file).replace(/\\/g, '/'),
        referencesAiCto: content.includes('ai-cto'),
        referencesPackage: content.includes('package.json'),
        uploadArtifacts: content.includes('upload-artifact')
      };
    });
}

function listPackageExecution(productRoot) {
  const pkg = readJson(path.join(productRoot, 'package.json')) || {};
  return Object.entries(pkg.scripts || {})
    .filter(([, command]) => /ai-cto|node|gradle|adb/.test(command))
    .map(([name, command]) => ({ name, command, rootImpact: 'UNCHANGED' }));
}

function buildWholeBodyConvergencePlan(options = {}) {
  const productRoot = options.productRoot || path.resolve(__dirname, '..');
  const canonicalRoot = path.join(productRoot, 'ai-cto');
  const donorRoot = options.donorRoot || 'C:\\Users\\ADMIN\\ai-cto';
  const mapping = buildTransplantationPlan({ productRoot, donorRoot });
  const transplant = buildSelectiveTransplantPlan({ productRoot, donorRoot });
  const identity = buildOperationalIdentity();
  const packageExecution = listPackageExecution(productRoot);
  const workflows = listWorkflowReferences(productRoot);
  const activeImports = traceImports(canonicalRoot).slice(0, 250);

  const authorities = {
    runtime: 'MyKeyboard/ai-cto',
    androidRuntime: 'MyKeyboard/app',
    governance: 'MyKeyboard/ai-cto/canonical-governance-core.js',
    memory: 'MyKeyboard/ai-cto/canonical-memory-core.js',
    dataset: 'MyKeyboard/ai-cto/canonical-dataset-core.js',
    identity: 'MyKeyboard/ai-cto/operational-identity-engine.js',
    founderDna: donorRoot
  };

  return {
    generatedAt: new Date().toISOString(),
    phases: CONVERGENCE_PHASES,
    currentAuthority: 'MyKeyboard/ai-cto runtime body with C:\\Users\\ADMIN\\ai-cto as donor brain',
    targetAuthority: 'MyKeyboard/ai-cto as single canonical nervous system',
    authorities,
    runtimeDependencies: {
      npmScripts: packageExecution,
      workflows,
      whatsapp: packageExecution.filter((script) => /whatsapp/i.test(script.name + script.command)),
      productLab: packageExecution.filter((script) => /product-lab|ux-lab|screenshot|emulator/i.test(script.name + script.command))
    },
    activeImportPaths: activeImports,
    executionRootImpact: 'UNCHANGED',
    workflowImpact: 'UNCHANGED',
    whatsappImpact: 'UNCHANGED',
    memoryImpact: 'CANONICAL_CORE_DECLARED_NO_STORE_MERGE',
    datasetImpact: 'CANONICAL_CORE_DECLARED_NO_DATASET_MOVE',
    founderDnaValue: transplant.safeCandidates.slice(0, 40),
    identity,
    convergencePhases: [
      { phase: 'A', name: 'INTELLIGENCE_CONVERGENCE', status: 'ACTIVE_SAFE', method: 'Additive founder-aligned reasoning cores only.' },
      { phase: 'B', name: 'MEMORY_CONVERGENCE', status: 'DECLARED_NOT_MERGED', method: 'Single authority contract; persistence remains untouched.' },
      { phase: 'C', name: 'DATASET_CONVERGENCE', status: 'DECLARED_NOT_MOVED', method: 'Single local-first dataset authority contract; no files moved.' },
      { phase: 'D', name: 'GOVERNANCE_CONVERGENCE', status: 'DECLARED_NOT_REPLACED', method: 'Canonical governance core identifies one authority; enforcement path unchanged.' },
      { phase: 'E', name: 'SHADOW_RETIREMENT', status: 'BLOCKED_UNTIL_PROOF', method: 'Retire only after no imports/workflows/package/WhatsApp references remain.' }
    ],
    retirementSafety: {
      canRetireNow: false,
      requiredProof: [
        'no active imports remain',
        'no workflow references remain',
        'no package references remain',
        'no WhatsApp references remain',
        'no hidden runtime assumptions remain',
        'no unresolved memory authority remains'
      ]
    },
    rollbackStrategy: [
      'Remove additive convergence modules and reports.',
      'No package.json, workflow, WhatsApp, or Android restoration required because paths are unchanged.',
      'Donor root remains intact as rollback intelligence source.'
    ],
    convergenceConfidence: {
      level: 'MEDIUM_HIGH_FOR_IDENTITY_CONVERGENCE',
      reason: 'Execution roots are stable and one canonical authority is declared, but memory/dataset/governance persistence is intentionally not merged yet.'
    }
  };
}

function renderConvergenceReport(title, plan, extraLines = []) {
  const lines = [`# ${title}`, ''];
  lines.push('## CURRENT AUTHORITY');
  lines.push(`- ${plan.currentAuthority}`);
  lines.push('');
  lines.push('## TARGET AUTHORITY');
  lines.push(`- ${plan.targetAuthority}`);
  lines.push('');
  lines.push('## RUNTIME DEPENDENCIES');
  lines.push(`- npm/script paths mapped: ${plan.runtimeDependencies.npmScripts.length}`);
  lines.push(`- workflow paths mapped: ${plan.runtimeDependencies.workflows.length}`);
  lines.push(`- WhatsApp paths mapped: ${plan.runtimeDependencies.whatsapp.length}`);
  lines.push(`- Product Lab paths mapped: ${plan.runtimeDependencies.productLab.length}`);
  lines.push('');
  lines.push('## ACTIVE IMPORT PATHS');
  for (const item of plan.activeImportPaths.slice(0, 15)) {
    lines.push(`- ${item.file}: ${item.dependencies.slice(0, 6).join(', ')}`);
  }
  lines.push('');
  lines.push('## EXECUTION ROOT IMPACT');
  lines.push(`- ${plan.executionRootImpact}`);
  lines.push('');
  lines.push('## WORKFLOW IMPACT');
  lines.push(`- ${plan.workflowImpact}`);
  lines.push('');
  lines.push('## WHATSAPP IMPACT');
  lines.push(`- ${plan.whatsappImpact}`);
  lines.push('');
  lines.push('## MEMORY IMPACT');
  lines.push(`- ${plan.memoryImpact}`);
  lines.push('');
  lines.push('## DATASET IMPACT');
  lines.push(`- ${plan.datasetImpact}`);
  lines.push('');
  lines.push('## FOUNDER DNA VALUE');
  for (const item of plan.founderDnaValue.slice(0, 10)) lines.push(`- ${item.source}: ${item.founderDnaValue}`);
  lines.push('');
  lines.push('## RETIREMENT SAFETY');
  lines.push(`- Can retire now: ${plan.retirementSafety.canRetireNow}`);
  for (const proof of plan.retirementSafety.requiredProof) lines.push(`- Required proof: ${proof}`);
  lines.push('');
  lines.push('## ROLLBACK STRATEGY');
  for (const step of plan.rollbackStrategy) lines.push(`- ${step}`);
  lines.push('');
  lines.push('## CONVERGENCE CONFIDENCE');
  lines.push(`- ${plan.convergenceConfidence.level}: ${plan.convergenceConfidence.reason}`);
  if (extraLines.length) {
    lines.push('');
    lines.push(...extraLines);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  CONVERGENCE_PHASES,
  buildWholeBodyConvergencePlan,
  renderConvergenceReport
};
