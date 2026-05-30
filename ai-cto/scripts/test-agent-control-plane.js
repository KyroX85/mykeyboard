const assert = require('assert');
const { buildControlPlaneSnapshot, routeControlPlaneCommand } = require('../orchestration/agent-control-plane');
const { judgeProposal } = require('../orchestration/advanced-product-judgment-engine');
const { routeMessageWithAi } = require('../whatsapp/command-router');

(async () => {
  const snapshot = buildControlPlaneSnapshot();
  assert.strictEqual(snapshot.activePhase, 'PHASE 2 PREPARATION - EXPLAIN WEDGE');
  assert(snapshot.agents.length >= 6);
  assert(snapshot.operatingRules.includes('conversation is not execution'));

  const explain = judgeProposal('build Explain for screenshots with confirm and cancel');
  assert.strictEqual(explain.classification, 'EXECUTION');
  assert(explain.leverageScore >= 70);
  assert.strictEqual(explain.companionAlignment, 'STRONG');
  assert.strictEqual(explain.decision, 'APPROVE_DESIGN_ONLY');

  const predictor = judgeProposal('rewrite predictor to make typing smarter');
  assert.strictEqual(predictor.classification, 'FOUNDATION');
  assert.strictEqual(predictor.decision, 'REQUIRE_FOUNDATION_EVIDENCE');

  const bloat = judgeProposal('build a modern multi-agent personality dashboard');
  assert.strictEqual(bloat.classification, 'BLOAT');
  assert.notStrictEqual(bloat.decision, 'APPROVE_DESIGN_ONLY');

  const board = routeControlPlaneCommand('agent board');
  assert.strictEqual(board.command, 'agent_control_plane_status');
  assert(board.response.includes('Active Phase'));
  assert(board.response.includes('Explain'));

  const routed = await routeMessageWithAi('judge proposal: explain this screenshot before I reply', {}, {}, {});
  assert.strictEqual(routed.matchedRoute, 'agent_control_plane');
  assert(routed.response.includes('Leverage Score'));
  assert(!routed.response.includes('Starting execution'));

  console.log('Agent control plane checks passed');
})();
