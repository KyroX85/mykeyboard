const assert = require('assert');

const {
  classifyExecutionIntent,
  enforceExecutionSchemaOnRoute,
  outputTypeForIntent,
  selfCheck
} = require('../execution-schema-enforcer');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');

(async () => {
  assert.strictEqual(classifyExecutionIntent({ message: 'Project audit' }).intentType, 'audit');
  assert.strictEqual(outputTypeForIntent('audit'), 'AUDIT_REPORT');
  assert.strictEqual(outputTypeForIntent('planning_request'), 'TASK_PLAN');
  assert.strictEqual(outputTypeForIntent('execution_command'), 'EXECUTION_RESULT');
  assert.strictEqual(outputTypeForIntent('unclear'), 'CLARIFICATION_REQUEST');

  assert.strictEqual(selfCheck({
    route: { response: 'ok' },
    classification: { intentType: 'audit', confidence: 0.9 },
    outputType: 'TASK_PLAN'
  }).ok, false);

  const guarded = enforceExecutionSchemaOnRoute({
    command: 'memory_audit',
    matchedRoute: 'founder_memory_intent',
    response: 'Memory Sources Used: current message\nReality reconstruction'
  }, {
    message: 'Project audit',
    memorySources: ['current message', 'persistent founder memory']
  });
  assert(guarded.response.includes('type: AUDIT_REPORT'));
  assert(guarded.response.includes('intent: audit'));
  assert(!guarded.response.includes('type: TASK_PLAN'));

  const mismatch = enforceExecutionSchemaOnRoute({
    command: 'founder_memory_question',
    matchedRoute: 'founder_memory_intent',
    response: 'Implemented: fake work\nFiles changed: test.js'
  }, {
    message: 'what phase are we in?',
    memorySources: ['current message']
  });
  assert.strictEqual(mismatch.command, 'clarification_required');
  assert(mismatch.response.includes('type: CLARIFICATION_REQUEST'));

  const audit = routeMessage('Project audit. Answer only from memory.', {}, {});
  assert(audit.response.startsWith('Memory Sources Used:'));
  assert(audit.response.includes('type: AUDIT_REPORT'));
  assert(audit.response.includes('intent: audit'));
  assert(!audit.response.includes('type: TASK_PLAN'));

  const plan = routeMessage('design the glass handle activation but do not start implementation', {}, {});
  assert(plan.response.includes('type: TASK_PLAN'));
  assert(plan.response.includes('intent: planning_request'));
  assert(!plan.response.includes('type: AUDIT_REPORT'));

  const unclear = routeMessage('do the thing', {}, {});
  assert(unclear.response.includes('type: CLARIFICATION_REQUEST'));
  assert(unclear.response.includes('intent: unclear'));

  const execution = await routeMessageWithAi('capture screenshot', {}, {}, {
    fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'blocked' }),
    env: {}
  });
  assert(execution.response.includes('type: EXECUTION_RESULT'));
  assert(execution.response.includes('intent: execution_command'));

  console.log('Execution schema enforcer checks passed');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
