const PRODUCT_SIGNALS = [
  'build stability',
  'swipe reliability',
  'typing latency',
  'correction bursts',
  'backspace rate',
  'APK growth',
  'memory growth',
  'hot-path allocations',
  'render cost',
  'startup cost',
  'crash likelihood',
  'touch confidence',
  'keypress responsiveness'
];

const LOW_IMPACT_PATTERN = /report|documentation|doc|cleanup|audit|summary|architecture|abstraction|formatting|wording/i;
const FORBIDDEN_SCOPE_PATTERN = /workflow|dependency|gradle|network|telemetry|persistence|auth|security system|prediction model|redesign|new agent|permission/i;

function classifyOperationalImpact(item = {}) {
  const text = [item.title, item.expectedImpact, item.runtimeImpact, ...(item.signals || [])].join(' ');
  const matchedSignals = PRODUCT_SIGNALS.filter((signal) => text.toLowerCase().includes(signal.toLowerCase()));
  if (matchedSignals.length > 0) {
    return {
      level: 'PRODUCT IMPACT',
      matchedSignals,
      reason: `Touches product signal(s): ${matchedSignals.join(', ')}`
    };
  }

  if (LOW_IMPACT_PATTERN.test(text)) {
    return {
      level: 'LOW OPERATIONAL IMPACT',
      matchedSignals: [],
      reason: 'Documentation, cleanup, audit, report, or abstraction work without measured runtime/UX signal.'
    };
  }

  return {
    level: 'UNMEASURED',
    matchedSignals: [],
    reason: 'No meaningful product signal was supplied.'
  };
}

function detectFakeProductivity(state = {}, actions = []) {
  const completed = [
    ...array(state.sections && state.sections.completedFixes),
    ...array(state.changed && state.changed.completed),
    ...actions.map((action) => action.action || action.title || '')
  ];
  const flags = [];

  const lowImpactCount = completed.filter((item) => LOW_IMPACT_PATTERN.test(String(item))).length;
  if (lowImpactCount >= 2) flags.push('LOW OPERATIONAL IMPACT: repeated docs/reports/cleanup without product signal.');
  if (completed.filter((item) => /report|summary/i.test(String(item))).length >= 2) flags.push('Report spam risk detected.');
  if (completed.some((item) => /architecture|abstraction/i.test(String(item)))) flags.push('Abstraction activity without typing improvement signal.');

  const risks = array(state.sections && state.sections.risks).concat(array(state.sections && state.sections.unresolved));
  if (risks.length > 0 && lowImpactCount > 0) flags.push('Activity without improvement: risks remain while low-impact work continues.');

  return flags.length ? flags : ['No fake productivity pattern detected.'];
}

function validatePatchProposal(proposal = {}) {
  const required = [
    'title',
    'exactFiles',
    'exactConstants',
    'expectedImprovement',
    'runtimeImpact',
    'regressionRisk',
    'rollbackComplexity',
    'riskLevel'
  ];

  for (const field of required) {
    const value = proposal[field];
    if (Array.isArray(value) ? value.length === 0 : !String(value || '').trim()) {
      return { ok: false, reason: `Missing required proposal field: ${field}` };
    }
  }

  const text = [
    proposal.title,
    proposal.expectedImprovement,
    proposal.runtimeImpact,
    ...(proposal.exactFiles || []),
    ...(proposal.exactConstants || [])
  ].join(' ');

  if (proposal.riskLevel !== 'LOW' || proposal.regressionRisk === 'HIGH' || proposal.rollbackComplexity === 'HIGH') {
    return { ok: false, reason: 'HIGH-risk patch proposal requires founder approval.' };
  }

  if (FORBIDDEN_SCOPE_PATTERN.test(text)) {
    return { ok: false, reason: 'Forbidden scope detected; founder approval required.' };
  }

  const impact = classifyOperationalImpact({
    title: proposal.title,
    expectedImpact: proposal.expectedImprovement,
    runtimeImpact: proposal.runtimeImpact
  });

  return {
    ok: true,
    reason: 'Patch proposal is bounded and reviewable.',
    impact
  };
}

function enforceMaintenanceLimits(actions = [], maxLowRisk = 3) {
  const allowed = [];
  const blocked = [];

  for (const action of actions) {
    if (action.riskLevel !== 'LOW') {
      blocked.push({ ...action, reason: 'HIGH-risk actions require founder approval.' });
      continue;
    }
    if (allowed.length >= maxLowRisk) {
      blocked.push({ ...action, reason: `Max ${maxLowRisk} LOW-risk actions per cycle reached.` });
      continue;
    }
    allowed.push(action);
  }

  return { allowed, blocked };
}

function summarizeOperationalAssistance(state = {}, fakePatterns = []) {
  const validation = array(state.validation);
  const failed = validation.filter((item) => String(item.status || '').toLowerCase() === 'failed').length;
  const passed = validation.filter((item) => String(item.status || '').toLowerCase() === 'passed').length;
  const risks = array(state.sections && state.sections.risks).concat(array(state.sections && state.sections.unresolved));
  const swipeRisk = risks.some((item) => /swipe|trail|gesture/i.test(String(item))) ? 'risk recorded' : 'not measured';
  const fake = fakePatterns.filter((item) => !/No fake productivity/i.test(item));

  return [
    'Operational assistance',
    `Build: ${failed ? `${failed} failing validation` : passed ? `${passed} passing validation` : 'not measured'}`,
    `Swipe: ${swipeRisk}`,
    `Founder load: ${risks.length} priority risk(s), ${fake.length} fake-progress warning(s)`,
    `Next: ${first(state.sections && state.sections.nextPriority) || 'validate highest product-risk item'}`
  ].join('\n');
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function first(value) {
  return array(value)[0] || null;
}

module.exports = {
  PRODUCT_SIGNALS,
  classifyOperationalImpact,
  detectFakeProductivity,
  validatePatchProposal,
  enforceMaintenanceLimits,
  summarizeOperationalAssistance
};
