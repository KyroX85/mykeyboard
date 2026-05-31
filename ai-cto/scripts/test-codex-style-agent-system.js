const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  FUTURE_PHONE_CAPABILITIES,
  MemoryLayer,
  ExecutorAgent,
  PlannerAgent,
  VerifierAgent,
  runCodexStyleAgentLoop,
  formatCodexStyleAgentLoop
} = require('../orchestration/codex-style-agent-system');
const { routeControlPlaneCommand } = require('../orchestration/agent-control-plane');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-style-agent-'));
try {
  fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'roadmap-lock.json'), JSON.stringify({
    currentPhase: 'Phase 2 - Explain',
    northStar: 'help users understand before they type'
  }));
  fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'VISION_NORTH_STAR.md'), 'Explain screenshot content without auto-send.');

  const memory = new MemoryLayer({ root: tempRoot });
  const memories = memory.retrieveRelevantMemories('Explain screenshot before typing');
  assert(memories.length >= 1);
  assert(memories[0].relativePath.includes('roadmap') || memories[0].relativePath.includes('VISION'));

  const result = runCodexStyleAgentLoop({
    goal: 'Create a phone-operated Codex-style agent with Accessibility and notification access gates',
    root: tempRoot
  });
  assert.strictEqual(result.status, 'SUCCESS');
  assert.strictEqual(result.chiefBrief.mode, 'PHONE_OPERATED_LONG_HORIZON');
  assert(result.memorySnapshot.memoryCount >= 1);
  assert(result.iterations[0].plan.taskGraph.nodes.length >= 5);
  assert(result.iterations[0].executionResults.every((item) => item.agent === 'Executor Agent'));
  assert(result.iterations[0].verifications.every((item) => item.passed));

  const executor = new ExecutorAgent();
  const planner = new PlannerAgent();
  const plan = planner.createPlan({ chiefBrief: result.chiefBrief, memorySnapshot: result.memorySnapshot });
  const capabilityTask = plan.taskGraph.nodes.find((node) => node.operation === 'CAPABILITY_CHECK');
  const capabilityExecution = executor.executeOne(capabilityTask, {});
  assert.strictEqual(capabilityExecution.artifact.capabilities.length, FUTURE_PHONE_CAPABILITIES.length);
  assert(capabilityExecution.logs.join(' ').includes('no phone control enabled'));

  const verifier = new VerifierAgent();
  const badVerification = verifier.verify(capabilityTask, {
    taskId: capabilityTask.id,
    status: 'PASS',
    logs: ['Done'],
    artifact: {}
  });
  assert.strictEqual(badVerification.passed, false);
  assert.strictEqual(badVerification.hallucinationRisk, 'ELEVATED');

  const formatted = formatCodexStyleAgentLoop(result);
  assert(formatted.includes('Chief Agent'));
  assert(formatted.includes('Planner Agent'));
  assert(formatted.includes('Executor Agent'));
  assert(formatted.includes('Verifier Agent'));
  assert(formatted.includes('Android Accessibility Service'));

  const routed = routeControlPlaneCommand('codex loop: build phone-operated long horizon execution');
  assert.strictEqual(routed.command, 'codex_style_agent_loop');
  assert(routed.response.includes('Codex-style phone agent system'));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Codex-style agent system checks passed');
