const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  FOUNDER_MEMORY_FILES,
  buildFounderMemorySystemContext,
  formatMemoryAudit,
  loadFounderMemoryLayer,
  retrieveRelevantFounderMemories
} = require('../founder-memory-layer');
const { formatRealityReconstruction } = require('../reality-reconstruction-layer');
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
assert(memoryLayer.memoryItems.length >= 8);

const missingRetrieval = retrieveRelevantFounderMemories('What are we missing?', memoryLayer);
assert.strictEqual(missingRetrieval.strategy, 'concept_relevance_ranking');
assert(missingRetrieval.items.some((item) => item.id === 'current_blocker_killer_feature'));
assert(missingRetrieval.items.some((item) => item.id === 'active_hypothesis_explain_wedge'));
assert(missingRetrieval.items.some((item) => item.id === 'founder_goal_understand_before_typing'));
assert(missingRetrieval.items.some((item) => item.id === 'agent_understanding_gap'));

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
assert(routed.response.includes('Reality reconstruction'));
assert(routed.response.includes('What product are we building?'));
assert(routed.response.includes('Evidence sources used:'));
assert(routed.response.includes('Missing information / uncertainty:'));
assert(!routed.response.includes('Founder memory audit'));

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
assert(projectAudit.response.includes('What stage are we in?'));
assert(projectAudit.response.includes('What should not be built?'));
assert(projectAudit.response.includes('Why I believe this:'));
assert(!projectAudit.response.includes('natural-response-builder'));
assert(!projectAudit.response.includes('AUDITOR'));

const productQuestion = routeMessage('what product are we building?', {}, {});
assert.strictEqual(productQuestion.command, 'founder_memory_question');
assert.strictEqual(productQuestion.matchedRoute, 'founder_memory_intent');
assert(productQuestion.response.includes('Aritenis is an Android keyboard'));
assert(productQuestion.response.includes('Reality reconstruction'));
assert(!productQuestion.response.includes('Current Foundation Health: protected.'));

const finalGoal = routeMessage('what is the final goal of our company?', {}, {});
assert.strictEqual(finalGoal.command, 'founder_objective_understanding');
assert(finalGoal.response.includes('Evidence used:'));
assert(finalGoal.response.includes('understand confusing content'));
assert(!finalGoal.response.includes('Recommended Next Step:'));

const doNotBuild = routeMessage('what should not be built right now?', {}, {});
assert.strictEqual(doNotBuild.command, 'founder_objective_understanding');
assert(doNotBuild.response.includes('auto-send'));
assert(doNotBuild.response.includes('Confidence:'));
assert(!doNotBuild.response.includes('100%'));

const missingQuestion = routeMessage('What are we missing?', {}, {});
assert.strictEqual(missingQuestion.command, 'founder_objective_understanding');
assert.strictEqual(missingQuestion.matchedRoute, 'founder_objective_engine');
assert(missingQuestion.response.includes('locked Phase 2 proof'));
assert(missingQuestion.response.includes('screenshot-powered Explain'));
assert(missingQuestion.response.includes('Top relevant founder memories:'));
assert(missingQuestion.response.includes('current_blocker_killer_feature'));
assert(missingQuestion.response.includes('active_hypothesis_explain_wedge'));
assert(!missingQuestion.response.includes('Current Foundation Health'));

const reconstruction = formatRealityReconstruction({ root, memoryLayer });
assert(reconstruction.includes('Reality reconstruction'));
assert(reconstruction.includes('Evidence sources used:'));
assert(reconstruction.includes('Missing information / uncertainty:'));

assert.strictEqual(classifyFounderIntent('what phase are we in?').intent, 'FOUNDER_MEMORY_QUESTION');
assert.strictEqual(classifyFounderIntent('implement memory audit').intent, 'EXECUTION_REQUEST');

(async () => {
  const routedAi = await routeMessageWithAi('memory audit', {}, {});
  assert.strictEqual(routedAi.command, 'memory_audit');
  assert(routedAi.response.includes('Reality reconstruction'));

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
