function classifyNotificationPriority({
  type = 'proactive',
  body = '',
  state = {},
  now = new Date(),
  founderLastSeenAt = null
} = {}) {
  const evidence = collectEvidence({ body, state, now, founderLastSeenAt });
  const text = `${body} ${evidence.map((item) => item.summary).join(' ')}`.toLowerCase();

  if (/\b(security|secret|credential|critical vulnerability)\b/.test(text)) {
    return priority('CRITICAL', 'security issue', evidence);
  }
  if (/\b(deployment failed|deploy failed|build failed|test failed|workflow failed|failed deployment)\b/.test(text) ||
    evidence.some((item) => item.kind === 'build_failure' || item.kind === 'test_failure' || item.kind === 'deployment_failure')) {
    return priority('CRITICAL', 'build/test/deployment failure', evidence);
  }
  if (evidence.some((item) => item.kind === 'approval_request')) {
    return priority('HIGH', 'founder approval is required', evidence);
  }
  if (evidence.some((item) => item.kind === 'major_milestone')) {
    return priority('HIGH', 'major milestone completed', evidence);
  }
  if (evidence.some((item) => item.kind === 'founder_inactive_72h')) {
    return priority('HIGH', 'founder inactive for 72h', evidence);
  }
  if (evidence.some((item) => item.kind === 'founder_inactive_24h')) {
    return priority('MEDIUM', 'founder inactive for 24h', evidence);
  }
  if (type === 'normal_status' && evidence.length) {
    return priority('MEDIUM', 'normal status with evidence', evidence);
  }
  return priority('LOW', 'no interrupt-worthy evidence', evidence);
}

function collectEvidence({ body = '', state = {}, now = new Date(), founderLastSeenAt = null } = {}) {
  const evidence = [];
  const sections = state.sections || {};
  const validation = Array.isArray(state.validation) ? state.validation : [];
  const changed = state.changed || {};
  const combined = [
    body,
    ...array(sections.risks),
    ...array(sections.unresolved),
    ...array(sections.approvals),
    ...array(sections.completedFixes),
    ...array(changed.completed),
    ...array(changed.newRisks)
  ].join(' ');

  for (const item of validation) {
    const status = String(item.status || '').toUpperCase();
    const task = String(item.task || 'validation task');
    if (status === 'FAILED') {
      evidence.push({
        kind: /test/i.test(task) ? 'test_failure' : 'build_failure',
        summary: `${task} failed`
      });
    }
  }

  if (/\b(deployment failed|deploy failed|workflow failed)\b/i.test(combined)) {
    evidence.push({ kind: 'deployment_failure', summary: 'deployment/workflow failure evidence found' });
  }
  if (/\b(build failed|assemble.*failed|compile.*failed)\b/i.test(combined)) {
    evidence.push({ kind: 'build_failure', summary: 'build failure evidence found' });
  }
  if (/\b(test failed|tests failed)\b/i.test(combined)) {
    evidence.push({ kind: 'test_failure', summary: 'test failure evidence found' });
  }
  if (/\b(security|secret|credential|critical vulnerability)\b/i.test(combined)) {
    evidence.push({ kind: 'security_issue', summary: 'security/secret evidence found' });
  }
  if (array(sections.approvals).length || /\bapproval required|awaiting approval|approve\b/i.test(combined)) {
    evidence.push({ kind: 'approval_request', summary: 'approval request evidence found' });
  }
  if (/\b(implemented|completed|shipped|merged|pushed)\b/i.test(combined) &&
    /\b(engine|layer|workflow|tests? passed|milestone)\b/i.test(combined)) {
    evidence.push({ kind: 'major_milestone', summary: 'major milestone completion evidence found' });
  }

  const inactiveHours = founderLastSeenAt
    ? (now.getTime() - new Date(founderLastSeenAt).getTime()) / 36e5
    : null;
  if (Number.isFinite(inactiveHours) && inactiveHours >= 72) {
    evidence.push({ kind: 'founder_inactive_72h', summary: 'founder inactive for 72h' });
  } else if (Number.isFinite(inactiveHours) && inactiveHours >= 24) {
    evidence.push({ kind: 'founder_inactive_24h', summary: 'founder inactive for 24h' });
  }

  return evidence;
}

function priority(level, reason, evidence) {
  return {
    priority: level,
    reason,
    evidence,
    interruptAllowed: ['CRITICAL', 'HIGH'].includes(level)
  };
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  classifyNotificationPriority,
  collectEvidence
};
