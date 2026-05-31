const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  FOUNDER_MEMORY_FILES,
  buildFounderMemorySystemContext,
  formatMemoryAudit,
  loadFounderMemoryLayer
} = require('../founder-memory-layer');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const { buildNvidiaCouncil } = require('../orchestration/nvidia-council-engine');
const { classifyFounderIntent } = require('../whatsapp/founder-intent-classifier');

const root = path.resolve(__dirname, '..', '..');
const memoryLayer = loadFounderMemoryLayer({ root });

assert.strictEqual(memoryLayer.missing.length, 0);
assert(memoryLayer.confidence >= 90);
assert.strictEqual(memoryLayer.files.length, FOUNDER_MEMORY_FILES.length);
assert(memoryLayer.audit.product.includes('Aritenis'));
assert(memoryLayer.audit.currentStage.includes('Phase 2'));
assert(memoryLayer.audit.activeHypothesis.includes('Explain'));

const audit = formatMemoryAudit(memoryLayer);
assert(audit.includes('What are we building?'));
assert(audit.includes('Why are we building it?'));
assert(audit.includes('Current stage:'));
assert(audit.includes('Current blocker:'));
assert(audit.includes('Current active hypothesis:'));
assert(audit.includes('Rejected directions:'));
assert(audit.includes('Next objective:'));
assert(!audit.includes('Current Foundation Health: protected.'));

const routed = routeMessage('memory audit', {}, {});
assert.strictEqual(routed.command, 'memory_audit');
assert.strictEqual(routed.matchedRoute, 'founder_memory_intent');
assert(routed.response.includes('Founder memory audit'));
assert(routed.response.includes('What are we building?'));

const projectAudit = routeMessage([
  'Project audit.',
  '',
  'Answer only from memory.',
  '',
  '1. What product are we building?',
  '2. What phase are we in?',
  '3. What is the active wedge?',
  '4. What has been rejected?',
  '5. What should not be built right now?',
  '6. If Kaamesh disappeared for 30 days, what would you continue working on?',
  '',
  'Do not propose features.',
  'Do not execute tasks.',
  'Do not create plans.',
  '',
  'Only reconstruct project state.'
].join('\n'), {}, {});
assert.strictEqual(projectAudit.command, 'memory_audit');
assert.strictEqual(projectAudit.matchedRoute, 'founder_memory_intent');
assert(projectAudit.response.includes('Current stage:'));
assert(projectAudit.response.includes('Rejected directions:'));
assert(!projectAudit.response.includes('natural-response-builder'));
assert(!projectAudit.response.includes('AUDITOR'));

const productQuestion = routeMessage('what product are we building?', {}, {});
assert.strictEqual(productQuestion.command, 'founder_memory_question');
assert.strictEqual(productQuestion.matchedRoute, 'founder_memory_intent');
assert(productQuestion.response.includes('Aritenis is an Android keyboard'));
assert(!productQuestion.response.includes('Current Foundation Health: protected.'));

const finalGoal = routeMessage('what is the final goal of our company?', {}, {});
assert.strictEqual(finalGoal.command, 'founder_memory_question');
assert(finalGoal.response.includes('Why are we building it?'));
assert(!finalGoal.response.includes('Recommended Next Step:'));

const doNotBuild = routeMessage('what should not be built right now?', {}, {});
assert.strictEqual(doNotBuild.command, 'founder_memory_question');
assert(doNotBuild.response.includes('auto-send'));

assert.strictEqual(classifyFounderIntent('what phase are we in?').intent, 'FOUNDER_MEMORY_QUESTION');
assert.strictEqual(classifyFounderIntent('implement memory audit').intent, 'EXECUTION_REQUEST');

(async () => {
  const routedAi = await routeMessageWithAi('memory audit', {}, {});
  assert.strictEqual(routedAi.command, 'memory_audit');
  assert(routedAi.response.includes('Founder memory audit'));

  const calls = [];
  const fakeClient = {
    available: () => true,
    chat: async (kind, messages) => {
      calls.push({ kind, messages });
      return {
        ok: true,
        model: kind,
        content: 'Position: SUPPORT\nEvidence: founder memory is loaded.\nRisk: low.\nRecommendation: discussion only.'
      };
    }
  };
  await buildNvidiaCouncil({
    proposal: 'What product are we building?',
    root,
    client: fakeClient
  });
  assert(calls.length > 0);
  assert(calls[0].messages[0].content.includes('Founder memory has higher priority than conversation history.'));
  assert(calls[0].messages[0].content.includes('FOUNDER_VISION.md'));

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'founder-memory-missing-'));
  try {
    const incomplete = loadFounderMemoryLayer({ root: tempRoot });
    assert(incomplete.confidence < 90);
    assert(formatMemoryAudit(incomplete).includes('I do not have enough founder context.'));
    assert(buildFounderMemorySystemContext(incomplete).includes('I do not have enough founder context.'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('Founder memory layer checks passed');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
