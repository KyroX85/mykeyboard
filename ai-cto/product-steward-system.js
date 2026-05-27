const { detectLowInformation } = require('./uncertainty-filter');
const { computePressureSummary } = require('./product-nervous-system');
const { detectContradictions } = require('./governance-consistency-engine');
const { synthesizeOperationalReality } = require('./operational-synthesis-engine');
const { enforceExecutionAllowed, readState } = require('../governance/governance');
const { classifyProposalPriority } = require('../intelligence/product-priority-engine');
const { applyStabilityFirstPolicy } = require('../governance/stability-first-policy');
const { evaluateTrustRisk } = require('../governance/trust-protection-engine');
const { evaluateChangeBudget } = require('../governance/change-budget-engine');
const { evaluateVanity } = require('../governance/anti-vanity-filter');

function runStewardLoop(input = {}) {
  const low = detectLowInformation(input.request || '');
  if (low.lowInformation) {
    return { blocked: true, reason: low.response, phase: 'PHASE_1_TRUSTED_KEYBOARD' };
  }

  const pressure = computePressureSummary(input.signals || {}, input.trustMap || {}, input.trend || {}, input.governance || {});
  const contradictions = detectContradictions(input.events || []);
  const trust = evaluateTrustRisk(input.risk || {});
  const budget = evaluateChangeBudget(input.budget || {});
  const vanity = evaluateVanity(input.proposal || '', Number(input.evidenceScore || 0));
  const stability = applyStabilityFirstPolicy(input.stability || {});
  const exec = enforceExecutionAllowed(input.action || 'analyze', input.context || {});
  const synthesis = synthesizeOperationalReality({
    blockedUnsafeRequests: input.blockedUnsafeRequests || [],
    unsafeExecutions: input.unsafeExecutions || [],
    contradictions: contradictions.incidents || [],
    trustIncidents: input.trustIncidents || [],
    pressure: normalizePressure(pressure.pressures)
  });

  return {
    phase: 'PHASE_1_TRUSTED_KEYBOARD',
    priority: classifyProposalPriority(input.proposal || ''),
    pressureFeed: pressure.feed,
    contradictions,
    trust,
    budget,
    vanity,
    stability,
    execution: exec,
    autonomy: readState().realAutonomyScore,
    synthesis
  };
}

function normalizePressure(pressures = {}) {
  const rank = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 95 };
  const out = {};
  for (const [k, v] of Object.entries(pressures)) out[k] = rank[v] || 0;
  return out;
}

module.exports = { runStewardLoop };

