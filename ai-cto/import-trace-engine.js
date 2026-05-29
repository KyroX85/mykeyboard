const { resolveRoots, traceImports } = require('./transplantation-orchestrator');

function traceCanonicalImports(options = {}) {
  const roots = resolveRoots(options);
  return {
    canonicalCto: traceImports(roots.canonicalCtoRoot),
    workflows: traceImports(roots.workflowsRoot)
  };
}

module.exports = { traceCanonicalImports };
