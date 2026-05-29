const assert = require('assert');
const path = require('path');

const { buildSelectiveTransplantPlan, classifyCandidate, proveNoRuntimeBreak } = require('../intelligence-transplant-engine');
const { translateFounderDna } = require('../founder-dna-translator');
const { planSafeGovernanceMerge } = require('../safe-governance-merger');
const { planMemoryConvergence } = require('../memory-convergence-engine');
const { planDatasetConvergence } = require('../dataset-convergence-engine');
const { verifyRuntimeSafeImports } = require('../runtime-safe-import-engine');
const { preventDuplicateRuntime } = require('../duplicate-runtime-preventer');
const { lockCanonicalRuntime } = require('../canonical-runtime-lock');
const { planShadowGovernanceElimination } = require('../shadow-governance-eliminator');
const { buildOperationalIdentity } = require('../operational-identity-engine');
const { planSingleBrainConvergence } = require('../single-brain-convergence-engine');
const { guardTransplantRegression } = require('../transplant-regression-guard');

const productRoot = path.resolve(__dirname, '..', '..');
const plan = buildSelectiveTransplantPlan({ productRoot });

assert(plan.classifications.includes('SAFE_TO_TRANSPLANT'));
assert.strictEqual(plan.sourceAuthority, 'C:\\Users\\ADMIN\\ai-cto');
assert.strictEqual(plan.targetAuthority, 'MyKeyboard/ai-cto');
assert(plan.safeCandidates.length > 0);
assert(plan.frozenSystems.includes('runtime execution'));
assert(plan.frozenSystems.includes('governance enforcement'));
assert(plan.frozenSystems.includes('memory persistence'));

assert.strictEqual(classifyCandidate('intelligence/product-priority-engine.js', 'trust retention product'), 'SAFE_TO_TRANSPLANT');
assert.strictEqual(classifyCandidate('runtime/execution.js', 'write files'), 'DANGEROUS_DUPLICATE');
assert.strictEqual(classifyCandidate('whatsapp-server.js', 'route message'), 'RUNTIME_CRITICAL');

const proof = proveNoRuntimeBreak({ productRoot });
assert.strictEqual(proof.npmCommandBreak, false);
assert.strictEqual(proof.workflowDependencyBreak, false);
assert.strictEqual(proof.whatsappActivationBreak, false);
assert.strictEqual(proof.governanceAuthorityConflict, false);
assert.strictEqual(proof.splitBrainMemoryCreation, false);

const dna = translateFounderDna({ productRoot });
assert(dna.translatedPrinciples.includes('trust over intelligence'));
assert.strictEqual(dna.translationMode, 'SEMANTIC_ONLY_NO_RUNTIME_REWIRE');

const governance = planSafeGovernanceMerge({ productRoot });
assert.strictEqual(governance.decision, 'DO_NOT_MERGE_GOVERNANCE_YET');

const memory = planMemoryConvergence({ productRoot });
assert.strictEqual(memory.decision, 'MEMORY_PERSISTENCE_FROZEN');

const dataset = planDatasetConvergence({ productRoot });
assert.strictEqual(dataset.decision, 'DATASET_PERSISTENCE_FROZEN');

const imports = verifyRuntimeSafeImports({ productRoot });
assert.strictEqual(imports.decision, 'NO_IMPORT_REWRITE');

const duplicate = preventDuplicateRuntime({ productRoot });
assert.strictEqual(duplicate.decision, 'ONE_RUNTIME_AUTHORITY_ONLY');

const lock = lockCanonicalRuntime({ productRoot });
assert.strictEqual(lock.packageJsonLock, 'UNCHANGED');
assert.strictEqual(lock.workflowLock, 'UNCHANGED');
assert.strictEqual(lock.whatsappLock, 'UNCHANGED');

const shadow = planShadowGovernanceElimination({ productRoot });
assert.strictEqual(shadow.decision, 'IDENTIFY_ONLY_NO_DELETE');

const identity = buildOperationalIdentity();
assert(identity.principles.includes('typing trust before intelligence'));

const convergence = planSingleBrainConvergence({ productRoot });
assert.strictEqual(convergence.decision, 'CONVERGE_INTELLIGENCE_FIRST');

const regression = guardTransplantRegression({ productRoot });
assert.strictEqual(regression.decision, 'ALLOW_STRATEGY_ONLY_TRANSPLANT');

console.log('Selective intelligence transplantation checks passed');
