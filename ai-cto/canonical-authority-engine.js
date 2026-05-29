const { buildTransplantationPlan, summarizePlan } = require('./transplantation-orchestrator');

function resolveCanonicalAuthority(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    ...summarizePlan(plan),
    canonicalExecutionAuthority: 'MyKeyboard/ai-cto',
    founderDnaAuthority: 'C:\\Users\\ADMIN\\ai-cto',
    androidRuntimeAuthority: 'MyKeyboard/app',
    decision: 'KEEP_NESTED_CTO_CANONICAL_FOR_EXECUTION',
    reason: 'GitHub workflows, npm scripts, WhatsApp, and Product Lab already activate the nested CTO path.'
  };
}

module.exports = { resolveCanonicalAuthority };
