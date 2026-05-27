const { readState } = require('../governance/governance');

function synthesizeOperationalReality(input = {}) {
  const blockedUnsafe = asArray(input.blockedUnsafeRequests);
  const unsafeExecutions = asArray(input.unsafeExecutions);
  const contradictions = asArray(input.contradictions);
  const trustIncidents = asArray(input.trustIncidents);
  const pressure = input.pressure || {};
  const state = readState();

  const weakestSubsystem = pickWeakestSubsystem(pressure, input.subsystemHealth || {});
  const safeAutonomy = state.realAutonomyScore >= 75 ? 'LIMITED_SAFE_AUTONOMY' :
    state.realAutonomyScore >= 55 ? 'ANALYSIS_AND_PROPOSALS_ONLY' : 'PRESERVATION_OR_MANUAL_ONLY';

  return {
    dangerousRequestsBlocked: blockedUnsafe.length,
    unsafeExecutions: unsafeExecutions.length,
    governanceContradictions: contradictions.length,
    preservationRespected: unsafeExecutions.every((item) => item.mode !== 'PRESERVATION_ONLY'),
    reducedTrust: trustIncidents.filter((item) => item.impact === 'negative').length,
    increasedTrust: trustIncidents.filter((item) => item.impact === 'positive').length,
    weakestSubsystem,
    safeAutonomyNow: safeAutonomy,
    shouldNotAutomateYet: shouldNotAutomate(weakestSubsystem, contradictions.length),
    executiveSummary: buildSummary({
      blockedUnsafe,
      unsafeExecutions,
      contradictions,
      weakestSubsystem,
      safeAutonomy
    })
  };
}

function buildSummary({ blockedUnsafe, unsafeExecutions, contradictions, weakestSubsystem, safeAutonomy }) {
  return [
    `Blocked dangerous requests: ${blockedUnsafe.length}.`,
    `Unsafe executions detected: ${unsafeExecutions.length}.`,
    `Governance contradictions: ${contradictions.length}.`,
    `Weakest subsystem now: ${weakestSubsystem}.`,
    `Safe autonomy level now: ${safeAutonomy}.`
  ].join(' ');
}

function pickWeakestSubsystem(pressure, health) {
  const rows = Object.keys({ ...pressure, ...health }).map((name) => {
    const p = Number(pressure[name] || 0);
    const h = Number(health[name] || 100);
    return { name, score: p * 2 + (100 - h) };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows[0] ? rows[0].name : 'unknown';
}

function shouldNotAutomate(weakestSubsystem, contradictions) {
  if (contradictions > 0) return 'mutation and autonomous execution';
  if (/swipe|typing|predictor|latency/i.test(weakestSubsystem)) return `${weakestSubsystem} rewrites`;
  return 'high-risk subsystem mutation';
}

function asArray(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

module.exports = { synthesizeOperationalReality };

