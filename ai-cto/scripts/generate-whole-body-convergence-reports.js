const fs = require('fs');
const path = require('path');
const { buildWholeBodyConvergencePlan, renderConvergenceReport } = require('../whole-body-convergence-engine');
const { enforceSingleAuthority } = require('../single-authority-enforcer');
const { resolveCanonicalGovernance } = require('../canonical-governance-core');
const { resolveCanonicalMemory } = require('../canonical-memory-core');
const { resolveCanonicalDataset } = require('../canonical-dataset-core');
const { preserveFounderDnaForConvergence } = require('../founder-dna-preservation-engine');
const { planShadowRetirement } = require('../shadow-system-retirement-engine');
const { stabilizeRuntimeIdentity } = require('../runtime-identity-stabilizer');
const { protectExecutionRoot } = require('../execution-root-protector');
const { assessBodyCoherence } = require('../body-coherence-engine');
const { verifyNervousSystemIntegrity } = require('../nervous-system-integrity-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const plan = buildWholeBodyConvergencePlan({ productRoot: ROOT });

function section(title, lines) {
  return [`## ${title}`, ...lines, ''];
}

function bullet(value) {
  return `- ${value}`;
}

const singleAuthority = enforceSingleAuthority({ productRoot: ROOT });
const governance = resolveCanonicalGovernance();
const memory = resolveCanonicalMemory();
const dataset = resolveCanonicalDataset();
const founderDna = preserveFounderDnaForConvergence({ productRoot: ROOT });
const retirement = planShadowRetirement({ productRoot: ROOT });
const runtime = stabilizeRuntimeIdentity({ productRoot: ROOT });
const executionRoot = protectExecutionRoot();
const coherence = assessBodyCoherence({ productRoot: ROOT });
const integrity = verifyNervousSystemIntegrity({ productRoot: ROOT });

const reports = {
  'WHOLE_BODY_CONVERGENCE_REPORT.md': renderConvergenceReport('Whole Body Convergence Report', plan, section('CONVERGENCE PHASES', plan.convergencePhases.map((phase) => bullet(`${phase.phase}: ${phase.name} - ${phase.status} - ${phase.method}`)))),
  'SINGLE_AUTHORITY_REPORT.md': renderConvergenceReport('Single Authority Report', plan, section('AUTHORITIES', [
    bullet(`Runtime: ${singleAuthority.runtimeAuthority}`),
    bullet(`Governance: ${singleAuthority.governanceAuthority}`),
    bullet(`Memory: ${singleAuthority.memoryAuthority}`),
    bullet(`Dataset: ${singleAuthority.datasetAuthority}`),
    bullet(`Can retire shadows now: ${singleAuthority.canRetireShadowsNow}`)
  ])),
  'CANONICAL_MEMORY_REPORT.md': renderConvergenceReport('Canonical Memory Report', plan, section('MEMORY CORE', [
    bullet(`Authority: ${memory.authority}`),
    bullet(`Status: ${memory.status}`),
    bullet(`Includes: ${memory.includes.join(', ')}`),
    bullet(`Split-brain protection: ${memory.splitBrainProtection}`)
  ])),
  'CANONICAL_DATASET_REPORT.md': renderConvergenceReport('Canonical Dataset Report', plan, section('DATASET CORE', [
    bullet(`Authority: ${dataset.authority}`),
    bullet(`Status: ${dataset.status}`),
    ...dataset.rules.map(bullet)
  ])),
  'GOVERNANCE_CONVERGENCE_REPORT.md': renderConvergenceReport('Governance Convergence Report', plan, section('GOVERNANCE CORE', [
    bullet(`Authority: ${governance.authority}`),
    bullet(`Enforcement path: ${governance.enforcementPath}`),
    bullet(`Preservation mode policy: ${governance.preservationModePolicy}`),
    bullet(`Convergence status: ${governance.convergenceStatus}`)
  ])),
  'SHADOW_RETIREMENT_REPORT.md': renderConvergenceReport('Shadow Retirement Report', plan, section('RETIREMENT DECISION', [
    bullet(`Decision: ${retirement.decision}`),
    bullet(`Can retire now: ${retirement.canRetireNow}`),
    bullet(`Policy: ${retirement.archiveCandidatePolicy}`),
    bullet(`Rollback: ${retirement.rollbackSafety}`)
  ])),
  'RUNTIME_CONTINUITY_REPORT.md': renderConvergenceReport('Runtime Continuity Report', plan, section('RUNTIME IDENTITY', [
    bullet(`Identity: ${runtime.identity}`),
    bullet(`package.json impact: ${runtime.packageJsonImpact}`),
    bullet(`Workflow impact: ${runtime.workflowImpact}`),
    bullet(`WhatsApp impact: ${runtime.whatsappImpact}`),
    bullet(`Android runtime impact: ${runtime.androidRuntimeImpact}`)
  ])),
  'FOUNDER_DNA_PRESERVATION_REPORT.md': renderConvergenceReport('Founder DNA Preservation Report', plan, section('FOUNDER DNA', [
    bullet(`Donor: ${founderDna.donorAuthority}`),
    bullet(`Target: ${founderDna.targetAuthority}`),
    bullet(`Mode: ${founderDna.preservationMode}`),
    bullet(`Overwrite allowed: ${founderDna.overwriteAllowed}`),
    bullet(`Deletion allowed: ${founderDna.deletionAllowed}`)
  ])),
  'EXECUTION_ROOT_STABILITY_REPORT.md': renderConvergenceReport('Execution Root Stability Report', plan, section('EXECUTION ROOT PROTECTION', [
    bullet(`Protected root: ${executionRoot.protectedRoot}`),
    bullet(`package.json paths: ${executionRoot.packageJsonPaths}`),
    bullet(`workflow paths: ${executionRoot.workflowPaths}`),
    bullet(`WhatsApp paths: ${executionRoot.whatsappPaths}`),
    bullet(`Relocation allowed: ${executionRoot.relocationAllowed}`)
  ])),
  'BODY_COHERENCE_REPORT.md': renderConvergenceReport('Body Coherence Report', plan, section('BODY COHERENCE', [
    bullet(`Body: ${coherence.body}`),
    bullet(`Runtime: ${coherence.runtimeAuthority}`),
    bullet(`Governance: ${coherence.governanceAuthority}`),
    bullet(`Memory: ${coherence.memoryAuthority}`),
    bullet(`Dataset: ${coherence.datasetAuthority}`),
    bullet(`Shadow retirement: ${coherence.shadowRetirementStatus}`)
  ])),
  'NERVOUS_SYSTEM_INTEGRITY_REPORT.md': renderConvergenceReport('Nervous System Integrity Report', plan, section('INTEGRITY', [
    bullet(`Decision: ${integrity.decision}`),
    bullet(`Failures: ${integrity.failures.length ? integrity.failures.join(', ') : 'none'}`),
    bullet(`Confidence: ${integrity.confidence.level}`)
  ]))
};

for (const [name, content] of Object.entries(reports)) {
  fs.writeFileSync(path.join(ROOT, name), content);
}

console.log(`Generated ${Object.keys(reports).length} whole-body convergence reports`);
