const assert = require('assert');
const { routeControlPlaneCommand } = require('../orchestration/agent-control-plane');
const { buildAgentCouncil } = require('../orchestration/agent-council-engine');
const { assessWeakWork } = require('../orchestration/weak-work-filter');

const explainCouncil = buildAgentCouncil('explain this screenshot before I reply');
assert.strictEqual(explainCouncil.decision, 'APPROVE_DESIGN_ONLY');
assert.strictEqual(explainCouncil.roadmap.classification, 'EXECUTION');
assert(explainCouncil.evidence.seen.length >= 1);
assert(explainCouncil.evidence.missing.includes('fresh Product Lab screenshot comparison'));
assert(explainCouncil.votes.some((vote) => vote.agent === 'Privacy Guardian'));
assert(explainCouncil.safeNextStep.includes('Design Explain flow'));

const autoSendCouncil = buildAgentCouncil('auto-send an explanation from every screenshot');
assert.strictEqual(autoSendCouncil.decision, 'BLOCK_TRUST_RISK');
assert(autoSendCouncil.votes.some((vote) => vote.position === 'BLOCK'));
assert(autoSendCouncil.safeNextStep.includes('confirm/cancel'));

const predictorCouncil = buildAgentCouncil('rewrite predictor to make typing smarter');
assert.strictEqual(predictorCouncil.decision, 'REQUIRE_FOUNDATION_EVIDENCE');
assert(predictorCouncil.safeNextStep.includes('Do not touch foundation'));

const weak = assessWeakWork('make agents smarter');
assert.strictEqual(weak.isWeak, true);
assert.strictEqual(weak.reason, 'No specific user pain, artifact, or success condition.');

const routedCouncil = routeControlPlaneCommand('agent council: explain this screenshot before I reply');
assert.strictEqual(routedCouncil.command, 'agent_council');
assert(routedCouncil.response.includes('Agent Council'));
assert(routedCouncil.response.includes('Evidence Seen'));
assert(routedCouncil.response.includes('Missing Evidence'));
assert(!routedCouncil.response.includes('Starting execution'));

const routedWeak = routeControlPlaneCommand('agent council: make agents smarter');
assert.strictEqual(routedWeak.command, 'weak_work_review');
assert(routedWeak.response.includes('Weak Work Detected'));
assert(routedWeak.response.includes('No execution started'));

console.log('Agent intelligence upgrade checks passed');
