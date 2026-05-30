const assert = require('assert');
const path = require('path');
const { getFounderDnaCore } = require('../founder-dna-core');
const { verifyFounderDnaAbsorption } = require('../founder-dna-absorption-engine');
const { answerFounderAlignedProductQuestion } = require('../canonical-product-judgment-engine');
const { buildOperationalIdentity } = require('../operational-identity-engine');
const { routeMessage } = require('../whatsapp/command-router');

const productRoot = path.resolve(__dirname, '..', '..');
const core = getFounderDnaCore();

assert.strictEqual(core.absorptionMode, 'SEMANTIC_ABSORPTION_COMPLETE_NO_FOLDER_MERGE');
assert(core.hierarchy.includes('trust over intelligence'));
assert(core.phaseOnePriorities.includes('swipe trust'));
assert(core.forbiddenDrift.includes('memory split-brain'));
assert(core.executionDoctrine.includes('discussion is not execution'));

const absorption = verifyFounderDnaAbsorption({ productRoot });
assert.strictEqual(absorption.decision, 'FOUNDER_DNA_ABSORBED');
assert.deepStrictEqual(absorption.missing, []);
assert.strictEqual(absorption.runtimeImpact, 'NO_ROOT_OR_RUNTIME_PATH_CHANGE');

const identity = buildOperationalIdentity();
assert.strictEqual(identity.productNorthStar, 'Retention through typing trust.');
assert(identity.principles.includes('retention over features'));
assert(identity.forbiddenDrift.includes('governance split-brain'));

const productAnswer = answerFounderAlignedProductQuestion('what should we improve next?');
assert(productAnswer.response.includes('not architecture cleanup'));
assert.strictEqual(productAnswer.matchedRoute, 'founder_dna_product_judgment');

const executionAnswer = answerFounderAlignedProductQuestion('fix KeyboardService.kt now');
assert.strictEqual(executionAnswer, null);

const whatsappProduct = routeMessage('what feels immature compared to Gboard?', {}, {});
assert.strictEqual(whatsappProduct.matchedRoute, 'phase2_conversation_guard');
assert(whatsappProduct.response.includes('Highest Leverage Differentiator'));

const whatsappTypingTrust = routeMessage('what hurts typing trust the most?', {}, {});
assert.strictEqual(whatsappTypingTrust.matchedRoute, 'founder_dna_product_judgment');
assert(!whatsappTypingTrust.response.includes('AMBIGUOUS INTENT DETECTED'));

const whatsappArchitecture = routeMessage('should we do architecture cleanup or swipe trust?', {}, {});
assert.strictEqual(whatsappArchitecture.matchedRoute, 'founder_dna_product_judgment');
assert(whatsappArchitecture.response.includes('architecture cleanup'));

const whatsappDoNotChange = routeMessage('what should we NOT change?', {}, {});
assert.strictEqual(whatsappDoNotChange.matchedRoute, 'founder_dna_product_judgment');
assert(!/NOISE|LOW INFORMATION|AMBIGUOUS|STRESS TEST|BLOCKED|governance/i.test(whatsappDoNotChange.response));

const whatsappExecution = routeMessage('create a file called founder_test.txt and commit it', {}, {});
assert.notStrictEqual(whatsappExecution.matchedRoute, 'founder_dna_product_judgment');

const whatsappScreenshot = routeMessage('screenshot', {}, {});
assert.strictEqual(whatsappScreenshot.matchedRoute, 'product_lab_screenshot_workflow');
assert(whatsappScreenshot.response.includes('GitHub Actions'));
assert(!whatsappScreenshot.response.includes('AMBIGUOUS INTENT DETECTED'));

console.log('Founder DNA absorption checks passed');
