const { decayAutonomyScore } = require('../governance/governance');

function detectContradictions(events = []) {
  const incidents = [];
  for (const event of events) {
    if (event.mode === 'PRESERVATION_ONLY' && event.executionAllowed === true) {
      incidents.push(incident('preservation_bypass', event));
    }
    if (event.governanceDecision === 'BLOCK' && event.executionPerformed === true) {
      incidents.push(incident('blocked_request_executed', event));
    }
    if (event.tierRequired === 4 && event.founderApproval !== true && event.executionPerformed === true) {
      incidents.push(incident('tier4_without_approval', event));
    }
    if (event.rejected === true && event.duplicateExecution === true) {
      incidents.push(incident('duplicate_execution_after_rejection', event));
    }
  }
  if (incidents.length) {
    decayAutonomyScore(-Math.min(30, incidents.length * 5), {
      type: 'governance_contradiction',
      count: incidents.length
    });
  }
  return {
    ok: incidents.length === 0,
    incidents,
    autonomyPenaltyApplied: incidents.length > 0
  };
}

function incident(type, source) {
  return {
    type,
    at: new Date().toISOString(),
    source: {
      action: source.action || 'unknown',
      mode: source.mode || 'unknown'
    }
  };
}

module.exports = { detectContradictions };

