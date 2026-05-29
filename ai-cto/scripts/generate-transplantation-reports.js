const fs = require('fs');
const path = require('path');
const { buildTransplantationPlan, renderReport } = require('../transplantation-orchestrator');
const { resolveCanonicalAuthority } = require('../canonical-authority-engine');
const { classifyDuplicateSystems } = require('../duplicate-classifier');
const { preserveFounderDna } = require('../founder-dna-preserver');
const { resolveShadowSystems } = require('../shadow-system-resolver');
const { mapRuntimeActivation } = require('../runtime-activation-mapper');
const { mapWorkflowDependencies } = require('../workflow-dependency-engine');
const { traceCanonicalImports } = require('../import-trace-engine');
const { unifyOperationalBrain } = require('../operational-brain-unifier');

const ROOT = path.resolve(__dirname, '..', '..');
const plan = buildTransplantationPlan({ productRoot: ROOT });

function section(title, content) {
  return `\n## ${title}\n${content}\n`;
}

function bullets(items, mapper = (item) => String(item)) {
  if (!items || items.length === 0) return '- None discovered in this pass.\n';
  return items.map((item) => `- ${mapper(item)}`).join('\n') + '\n';
}

function report(title, extra = '') {
  return renderReport(title, plan) + extra;
}

const authority = resolveCanonicalAuthority({ productRoot: ROOT });
const duplicates = classifyDuplicateSystems({ productRoot: ROOT });
const dna = preserveFounderDna({ productRoot: ROOT });
const shadow = resolveShadowSystems({ productRoot: ROOT });
const runtime = mapRuntimeActivation({ productRoot: ROOT });
const workflows = mapWorkflowDependencies({ productRoot: ROOT });
const imports = traceCanonicalImports({ productRoot: ROOT });
const brain = unifyOperationalBrain({ productRoot: ROOT });

const reports = {
  'TRANSPLANTATION_STRATEGY_REPORT.md': report(
    'Transplantation Strategy Report',
    section('STRATEGY DECISION', '- Strategy-only framework created.\n- No transplant executed.\n- Donor root remains read-only.\n')
  ),
  'CANONICAL_NERVOUS_SYSTEM_REPORT.md': report(
    'Canonical Nervous System Report',
    section('CANONICAL DECISION', bullets([
      `Decision: ${authority.decision}`,
      `Canonical execution authority: ${authority.canonicalExecutionAuthority}`,
      `Founder DNA authority: ${authority.founderDnaAuthority}`,
      `Reason: ${authority.reason}`
    ]))
  ),
  'DUPLICATE_AUTHORITY_REPORT.md': report(
    'Duplicate Authority Report',
    section('DUPLICATE MODULE COUNT', `- Duplicate basenames discovered: ${duplicates.length}\n`) +
    section('DANGEROUS DUPLICATES', bullets(duplicates.filter((item) => item.classification === 'DANGEROUS').slice(0, 30), (item) => `${item.name}`))
  ),
  'FOUNDER_DNA_REPORT.md': report(
    'Founder DNA Report',
    section('DONOR POLICY', `- ${dna.policy}\n- Overwrite allowed: ${dna.overwriteAllowed}\n`) +
    section('HIGH-SIGNAL DONOR SYSTEMS', bullets(dna.founderDnaSystems.slice(0, 40), (item) => `${item.file} (score ${item.score})`))
  ),
  'SHADOW_RUNTIME_REPORT.md': report(
    'Shadow Runtime Report',
    section('SHADOW SYSTEMS', bullets(shadow.shadowSystems, (item) => `${item.classification}: ${item.path} -> ${item.action}`))
  ),
  'SAFE_TRANSPLANT_SEQUENCE.md': report(
    'Safe Transplant Sequence',
    section('ORDER', bullets(plan.safeTransplantOrder))
  ),
  'RUNTIME_DEPENDENCY_MAP.md': report(
    'Runtime Dependency Map',
    section('NPM EXECUTION PATHS', bullets(runtime.npmExecution, (item) => `${item.name}: ${item.command}`)) +
    section('WHATSAPP PATHS', bullets(runtime.whatsapp, (item) => `${item.name}: ${item.command}`)) +
    section('PRODUCT LAB PATHS', bullets(runtime.productLab, (item) => `${item.name}: ${item.command}`))
  ),
  'WORKFLOW_EXECUTION_MAP.md': report(
    'Workflow Execution Map',
    section('WORKFLOWS', bullets(workflows, (item) => `${item.file} (${item.classification})`))
  ),
  'IMPORT_TRACE_REPORT.md': report(
    'Import Trace Report',
    section('CANONICAL IMPORT FILES', bullets(imports.canonicalCto.slice(0, 80), (item) => `${item.file}: ${item.dependencies.slice(0, 6).join(', ')}`)) +
    section('WORKFLOW REFERENCES', bullets(imports.workflows.slice(0, 25), (item) => `${item.file}: ${item.dependencies.slice(0, 6).join(', ')}`))
  ),
  'BRAIN_UNIFICATION_REPORT.md': report(
    'Brain Unification Report',
    section('UNIFICATION MODE', bullets([
      `Mode: ${brain.unificationMode}`,
      `Canonical execution system: ${brain.canonicalExecutionSystem}`,
      `Donor intelligence system: ${brain.donorIntelligenceSystem}`,
      `Next approval: ${brain.nextRequiredApproval}`
    ]))
  )
};

for (const [name, content] of Object.entries(reports)) {
  fs.writeFileSync(path.join(ROOT, name), content);
}

console.log(`Generated ${Object.keys(reports).length} transplantation reports`);
