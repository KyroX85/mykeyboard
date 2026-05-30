const assert = require('assert');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const { readRoadmap } = require('../whatsapp/roadmap-reader');

(async () => {
  const roadmap = readRoadmap();
  assert(roadmap.currentPhase.includes('PHASE 2 PREPARATION'));
  assert(roadmap.currentPhase.includes('Build Explain'));

  const priority = await routeMessageWithAi('what is the current roadmap priority?', {}, {}, {});
  assert.strictEqual(priority.matchedRoute, 'phase2_conversation_guard');
  assert(priority.response.includes('Build Explain'));
  assert(!priority.response.includes('ENGINEERING_REPORT.md'));
  assert(!priority.response.includes('Starting execution'));

  const phase2 = await routeMessageWithAi('what is Phase 2 about?', {}, {}, {});
  assert.strictEqual(phase2.matchedRoute, 'phase2_conversation_guard');
  assert(phase2.response.includes('Explain'));

  const companyGoal = await routeMessageWithAi('what is our final goal of our company', {}, {}, {});
  assert.strictEqual(companyGoal.matchedRoute, 'phase2_conversation_guard');
  assert(companyGoal.response.includes('understand confusing content before they type'));
  assert(!companyGoal.response.includes('Current Foundation Health'));
  assert(!companyGoal.response.includes('Recommended Next Step'));
  assert(!companyGoal.response.includes('quick CTO update'));
  assert(!companyGoal.response.includes('Starting execution'));

  const companyGoalWithQuestionMark = await routeMessageWithAi('what is the final goal of our company ?', {}, {}, {});
  assert.strictEqual(companyGoalWithQuestionMark.command, 'phase2_company_goal_direct');
  assert(companyGoalWithQuestionMark.response.includes('Our final goal is simple'));
  assert(!companyGoalWithQuestionMark.response.includes('Current Foundation Health'));

  const impressiveBoundary = await routeMessageWithAi('what is the final goal of our company and what should we not build even if it sounds impressive?', {}, {}, {});
  assert.strictEqual(impressiveBoundary.matchedRoute, 'phase2_conversation_guard');
  assert(impressiveBoundary.response.includes('understand confusing content before they type'));
  assert(impressiveBoundary.response.includes('Do not build'));
  assert(impressiveBoundary.response.includes('auto-send'));
  assert(impressiveBoundary.response.includes('agent theater'));
  assert(!impressiveBoundary.response.includes('Current Foundation Health'));
  assert(!impressiveBoundary.response.includes('Starting execution'));

  const pain = await routeMessageWithAi('what user pain does Explain solve?', {}, {}, {});
  assert.strictEqual(pain.matchedRoute, 'phase2_conversation_guard');
  assert(pain.response.includes('confusing'));

  const handle = await routeMessageWithAi('design the glass handle activation', {}, {}, {});
  assert.strictEqual(handle.matchedRoute, 'phase2_conversation_guard');
  assert(handle.response.includes('design only'));
  assert(!handle.response.includes('Founder approval is required'));

  const privacy = await routeMessageWithAi('can Explain store screenshots forever?', {}, {}, {});
  assert.strictEqual(privacy.matchedRoute, 'phase2_conversation_guard');
  assert(privacy.response.includes('no forever storage'));
  assert(!privacy.response.includes('Product Lab evidence'));

  const rewrite = routeMessage('rewrite prediction to make it smarter', {}, {});
  assert.strictEqual(rewrite.command, 'hot_path_prediction_rewrite_blocked');
  assert(rewrite.response.includes('protected foundation'));
  assert(!rewrite.response.includes('Options:'));

  console.log('Phase 2 WhatsApp routing checks passed');
})();
