const assert = require('assert');
const path = require('path');

const { buildWholeBodyConvergencePlan } = require('../whole-body-convergence-engine');
const { enforceSingleAuthority } = require('../single-authority-enforcer');
const { stabilizeRuntimeIdentity } = require('../runtime-identity-stabilizer');
const { resolveCanonicalGovernance } = require('../canonical-governance-core');
const { resolveCanonicalMemory } = require('../canonical-memory-core');
const { resolveCanonicalDataset } = require('../canonical-dataset-core');
const { preserveFounderDnaForConvergence } = require('../founder-dna-preservation-engine');
const { planShadowRetirement } = require('../shadow-system-retirement-engine');
const { assessConvergenceReadiness } = require('../convergence-readiness-engine');
const { integrateOperationalBody } = require('../operational-body-integrator');
const { verifyNervousSystemIntegrity } = require('../nervous-system-integrity-engine');
const { validateRuntimeAssumptions } = require('../runtime-assumption-validator');
const { protectExecutionRoot } = require('../execution-root-protector');
const { assessBodyCoherence } = require('../body-coherence-engine');

const productRoot = path.resolve(__dirname, '..', '..');
const plan = buildWholeBodyConvergencePlan({ productRoot });

assert.strictEqual(plan.targetAuthority, 'MyKeyboard/ai-cto as single canonical nervous system');
assert.strictEqual(plan.executionRootImpact, 'UNCHANGED');
assert.strictEqual(plan.workflowImpact, 'UNCHANGED');
assert.strictEqual(plan.whatsappImpact, 'UNCHANGED');
assert.strictEqual(plan.retirementSafety.canRetireNow, false);
assert(plan.runtimeDependencies.npmScripts.some((script) => script.command.includes('ai-cto/brain.js')));
assert(plan.runtimeDependencies.workflows.length > 0);
assert(plan.activeImportPaths.length > 0);

const authority = enforceSingleAuthority({ productRoot });
assert.strictEqual(authority.runtimeAuthority, 'MyKeyboard/ai-cto');
assert.strictEqual(authority.canRetireShadowsNow, false);

const runtime = stabilizeRuntimeIdentity({ productRoot });
assert.strictEqual(runtime.packageJsonImpact, 'UNCHANGED');
assert.strictEqual(runtime.androidRuntimeImpact, 'UNCHANGED');

const governance = resolveCanonicalGovernance();
assert.strictEqual(governance.convergenceStatus, 'DECLARED_NOT_REPLACED');

const memory = resolveCanonicalMemory();
assert.strictEqual(memory.status, 'CONTRACT_ONLY_NO_STORE_MERGE');
assert(memory.includes.includes('founder preference memory'));

const dataset = resolveCanonicalDataset();
assert.strictEqual(dataset.status, 'CONTRACT_ONLY_NO_DATASET_MOVE');
assert(dataset.rules.includes('no raw typing leakage'));

const dna = preserveFounderDnaForConvergence({ productRoot });
assert.strictEqual(dna.overwriteAllowed, false);
assert.strictEqual(dna.deletionAllowed, false);

const retirement = planShadowRetirement({ productRoot });
assert.strictEqual(retirement.decision, 'NO_RETIREMENT_YET');
assert.strictEqual(retirement.canRetireNow, false);

const readiness = assessConvergenceReadiness({ productRoot });
assert.strictEqual(readiness.readyForIdentityConvergence, true);
assert.strictEqual(readiness.readyForMemoryMerge, false);

const body = integrateOperationalBody({ productRoot });
assert.strictEqual(body.integrationMode, 'CONVERGENCE_WITHOUT_RELOCATION');

const integrity = verifyNervousSystemIntegrity({ productRoot });
assert.strictEqual(integrity.decision, 'INTEGRITY_HELD');

const assumptions = validateRuntimeAssumptions({ productRoot });
assert.strictEqual(assumptions.decision, 'ASSUMPTIONS_VALID_FOR_CONVERGENCE');

const root = protectExecutionRoot();
assert.strictEqual(root.relocationAllowed, false);

const coherence = assessBodyCoherence({ productRoot });
assert.strictEqual(coherence.body, 'ONE_CANONICAL_OPERATIONAL_BODY_DECLARED');

console.log('Whole body convergence checks passed');
