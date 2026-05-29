const assert = require('assert');
const path = require('path');

const { buildTransplantationPlan } = require('../transplantation-orchestrator');
const { resolveCanonicalAuthority } = require('../canonical-authority-engine');
const { classifyDuplicateSystems } = require('../duplicate-classifier');
const { resolveShadowSystems } = require('../shadow-system-resolver');
const { mapRuntimeActivation } = require('../runtime-activation-mapper');
const { mapWorkflowDependencies } = require('../workflow-dependency-engine');
const { traceCanonicalImports } = require('../import-trace-engine');
const { resolveGovernanceAuthority } = require('../governance-authority-resolver');
const { resolveMemoryAuthority } = require('../memory-authority-resolver');
const { resolveDatasetAuthority } = require('../dataset-authority-resolver');
const { planSafeTransplant } = require('../safe-transplant-engine');
const { preserveFounderDna } = require('../founder-dna-preserver');
const { unifyOperationalBrain } = require('../operational-brain-unifier');
const { consolidateNervousSystem } = require('../nervous-system-consolidator');

const productRoot = path.resolve(__dirname, '..', '..');
const plan = buildTransplantationPlan({ productRoot });

assert(plan.classifications.includes('CANONICAL'));
assert(plan.classifications.includes('FOUNDER_DNA'));
assert(plan.roots.canonicalCtoRoot.endsWith(path.join('MyKeyboard', 'ai-cto')));
assert(plan.roots.donorRoot.endsWith('ai-cto'));
assert(plan.runtimeActivation.npmExecution.some((entry) => entry.command.includes('ai-cto/brain.js')));
assert(plan.runtimeActivation.workflowExecution.some((entry) => entry.file.includes('.github/workflows')));
assert(plan.duplicates.length > 0);
assert(plan.founderDna.length > 0);
assert(plan.untouchableSystems.some((item) => item.includes('KeyboardService.kt')));

const authority = resolveCanonicalAuthority({ productRoot });
assert.strictEqual(authority.decision, 'KEEP_NESTED_CTO_CANONICAL_FOR_EXECUTION');

const duplicates = classifyDuplicateSystems({ productRoot });
assert(duplicates.some((item) => item.name === 'product-nervous-system.js'));

const shadow = resolveShadowSystems({ productRoot });
assert(shadow.shadowSystems.some((item) => item.classification === 'FOUNDER_DNA'));

const runtime = mapRuntimeActivation({ productRoot });
assert(runtime.productLab.length > 0);

const workflows = mapWorkflowDependencies({ productRoot });
assert(workflows.length >= 1);

const imports = traceCanonicalImports({ productRoot });
assert(imports.canonicalCto.some((item) => item.file.includes('scripts/')));

const governance = resolveGovernanceAuthority({ productRoot });
assert.strictEqual(governance.decision, 'MAP_ONLY_DO_NOT_REPLACE');

const memory = resolveMemoryAuthority({ productRoot });
assert.strictEqual(memory.decision, 'PRESERVE_DONOR_MEMORY_DO_NOT_OVERWRITE');

const dataset = resolveDatasetAuthority({ productRoot });
assert.strictEqual(dataset.decision, 'VERIFY_PRIVACY_BEFORE_TRANSPLANT');

const safe = planSafeTransplant({ productRoot });
assert.strictEqual(safe.canMoveFiles, false);
assert.strictEqual(safe.canRewriteImports, false);
assert.strictEqual(safe.canTouchRuntime, false);

const dna = preserveFounderDna({ productRoot });
assert.strictEqual(dna.overwriteAllowed, false);

const brain = unifyOperationalBrain({ productRoot });
assert.strictEqual(brain.unificationMode, 'MAP_AND_STRATEGIZE_ONLY');

const consolidated = consolidateNervousSystem({ productRoot });
assert.strictEqual(consolidated.decision, 'DO_NOT_CONSOLIDATE_FILES_YET');

console.log('Nervous system transplantation mapping checks passed');
