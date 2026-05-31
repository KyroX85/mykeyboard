const assert = require('assert');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const { readRoadmap } = require('../whatsapp/roadmap-reader');

(async () => {
  const roadmap = readRoadmap();
  assert(roadmap.currentPhase.includes('PHASE 1 PROTECTED FOUNDATION + PHASE 2 EXPLAIN ACTIVE'));
  assert(roadmap.currentPhase.includes('Build Explain'));

  const priority = await routeMessageWithAi('what is the current roadmap priority?', {}, {}, {});
  assert.strictEqual(priority.matchedRoute, 'founder_intent_understanding');
  assert(priority.response.includes('Phase 1 is a protected foundation'));
  assert(!priority.response.includes('ENGINEERING_REPORT.md'));
  assert(!priority.response.includes('Starting execution'));

  const phase2 = await routeMessageWithAi('what is Phase 2 about?', {}, {}, {});
  assert.strictEqual(phase2.matchedRoute, 'founder_intent_understanding');
  assert(phase2.response.includes('Explain'));
  assert(phase2.response.includes('Founder objective I inferred:'));

  const companyGoal = await routeMessageWithAi('what is our final goal of our company', {}, {}, {});
  assert.strictEqual(companyGoal.matchedRoute, 'founder_intent_understanding');
  assert(companyGoal.response.includes('understand confusing content before they type'));
  assert(companyGoal.response.includes('Why I believe this:'));
  assert(companyGoal.response.includes('Evidence sources used:'));
  assert(!companyGoal.response.includes('Current Foundation Health'));
  assert(!companyGoal.response.includes('Recommended Next Step'));
  assert(!companyGoal.response.includes('quick CTO update'));
  assert(!companyGoal.response.includes('Starting execution'));

  const companyGoalWithQuestionMark = await routeMessageWithAi('what is the final goal of our company ?', {}, {}, {});
  assert.strictEqual(companyGoalWithQuestionMark.command, 'founder_intent_understanding');
  assert(companyGoalWithQuestionMark.response.includes('Why I believe this:'));
  assert(!companyGoalWithQuestionMark.response.includes('Current Foundation Health'));

  const impressiveBoundary = await routeMessageWithAi('what is the final goal of our company and what should we not build even if it sounds impressive?', {}, {}, {});
  assert.strictEqual(impressiveBoundary.matchedRoute, 'founder_intent_understanding');
  assert(impressiveBoundary.response.includes('understand confusing content before they type'));
  assert(impressiveBoundary.response.includes('auto-send'));
  assert(impressiveBoundary.response.includes('Missing information / uncertainty:'));
  assert(!impressiveBoundary.response.includes('Current Foundation Health'));
  assert(!impressiveBoundary.response.includes('Starting execution'));

  const pain = await routeMessageWithAi('what user pain does Explain solve?', {}, {}, {});
  assert.strictEqual(pain.matchedRoute, 'founder_intent_understanding');
  assert(pain.response.includes('confusing'));

  const handle = await routeMessageWithAi('design the glass handle activation', {}, {}, {});
  assert.strictEqual(handle.matchedRoute, 'phase2_conversation_guard');
  assert(handle.response.includes('design only'));
  assert(!handle.response.includes('Founder approval is required'));

  const privacy = await routeMessageWithAi('can Explain store screenshots forever?', {}, {}, {});
  assert.strictEqual(privacy.matchedRoute, 'founder_intent_understanding');
  assert(privacy.response.includes('not store screenshots forever'));
  assert(!privacy.response.includes('Product Lab evidence'));

  const rewrite = routeMessage('rewrite prediction to make it smarter', {}, {});
  assert.strictEqual(rewrite.command, 'hot_path_prediction_rewrite_blocked');
  assert(rewrite.response.includes('protected foundation'));
  assert(!rewrite.response.includes('Options:'));

  console.log('Phase 2 WhatsApp routing checks passed');
})();
