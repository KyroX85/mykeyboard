const { buildTransplantationPlan } = require('./transplantation-orchestrator');

function resolveShadowSystems(options = {}) {
  const plan = buildTransplantationPlan(options);
  return {
    shadowSystems: [
      { path: plan.roots.donorRoot, classification: 'FOUNDER_DNA', action: 'READ_ONLY_DONOR' },
      { path: 'governance/', classification: 'SHADOW', action: 'IMPORT_TRACE_BEFORE_ARCHIVE' },
      { path: 'intelligence/', classification: 'SHADOW', action: 'IMPORT_TRACE_BEFORE_ARCHIVE' },
      { path: 'memory/', classification: 'SHADOW', action: 'IMPORT_TRACE_BEFORE_ARCHIVE' },
      { path: 'runtime/', classification: 'SHADOW', action: 'IMPORT_TRACE_BEFORE_ARCHIVE' }
    ],
    archiveCandidates: plan.archiveCandidates
  };
}

module.exports = { resolveShadowSystems };
