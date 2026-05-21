function generatePassiveWorkerUpdates(state, sources = {}) {
  const updates = [];
  const execution = sources.execution || {};
  const maintenance = sources.maintenance || {};

  if (Array.isArray(execution.completed) && execution.completed.length > 0) {
    updates.push(`Sir, ${owner(execution.completed[0])} completed ${execution.completed[0].action} with rollback notes recorded.`);
  }

  if (Array.isArray(execution.dryRun) && execution.dryRun.length > 0) {
    updates.push(`Sir, ${owner(execution.dryRun[0])} paused at dry-run for ${execution.dryRun[0].action}. No risky execution done.`);
  }

  if (Array.isArray(execution.blocked) && execution.blocked.length > 0) {
    updates.push(`Sir, ${owner(execution.blocked[0])} blocked ${execution.blocked[0].action}; guardrails stayed active.`);
  }

  if (Array.isArray(execution.rolledBack) && execution.rolledBack.length > 0) {
    updates.push(`Sir, ${owner(execution.rolledBack[0])} needs rollback review for ${execution.rolledBack[0].action}.`);
  }

  if (Array.isArray(maintenance.blocked) && maintenance.blocked.length > 0) {
    updates.push(`Sir, Auditor still blocking ${maintenance.blocked[0].action}; not safe enough yet.`);
  }

  const sections = (state && state.sections) || {};
  const topRisk = first(sections.risks) || first(sections.unresolved);
  if (topRisk) {
    updates.push(`Sir, Reviewer still sees risk: ${compact(topRisk)}.`);
  }

  return updates.map((line) => compact(line, 178)).slice(0, 4);
}

function owner(entry) {
  return entry && entry.owning_agent ? entry.owning_agent : 'CTO';
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function compact(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

module.exports = {
  generatePassiveWorkerUpdates
};
