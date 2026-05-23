const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyDecision,
  mergePolicy,
  topThreeRisks,
  immediateAlerts,
  schoolModeDigest,
  groupChatDailyUpdate
} = require('../whatsapp/school-mode-policy');
const { readRoadmap } = require('../whatsapp/roadmap-reader');
const { readActionLog, logAgentAction } = require('../whatsapp/agent-action-log');
const { requestSpecialistSpawn, answerSpecialistSpawn, readSpawnState } = require('../whatsapp/specialist-agent-manager');
const { buildMessage } = require('./send-whatsapp-report');
const { stabilizeSemanticMemory } = require('../whatsapp/semantic-memory');
const { routeMessage } = require('../whatsapp/command-router');

const root = path.resolve(__dirname, '..', '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'engineering-maintenance.yml'), 'utf8');
const manual = fs.readFileSync(path.join(root, 'ai-cto', 'GEMINI.md'), 'utf8');
const roadmapText = fs.readFileSync(path.join(root, 'ai-cto', 'AGENT_ROADMAP.md'), 'utf8');
const visionText = fs.readFileSync(path.join(root, 'ai-cto', 'VISION_NORTH_STAR.md'), 'utf8');
const actionLogPath = path.join(root, 'ai-cto', 'agent-action-log.json');
const spawnPath = path.join(root, 'ai-cto', 'spawned-agents.json');

process.on('exit', () => {
  fs.writeFileSync(actionLogPath, JSON.stringify({ version: '1.0', actions: [] }, null, 2));
  fs.writeFileSync(spawnPath, JSON.stringify({ version: '1.0', pending: null, active: [] }, null, 2));
});

const state = {
  healthScore: 64,
  momentum: 'RECOVERING',
  validation: [],
  sections: {
    risks: ['Swipe instability above zero risk.'],
    unresolved: ['Typing confidence not fully verified yet.', 'Symbol pain still exists.'],
    repeatedFailures: ['Report-only loop repeated.'],
    approvals: ['Prediction engine change needs founder approval.'],
    completedFixes: [],
    nextPriority: ['Measure real-device typing friction.'],
    safestOpportunity: ['Suggest symbol layout validation.']
  },
  changed: { completed: [], newRisks: ['Swipe instability above zero risk.'] },
  summary: {
    nextPriority: 'Measure real-device typing friction.',
    topRisk: 'Swipe instability above zero risk.'
  }
};

assert.strictEqual(classifyDecision({ risk: 'LOW', size: 'small' }).mode, 'DECIDE_AND_REPORT');
assert.strictEqual(classifyDecision({ risk: 'HIGH', size: 'big' }).mode, 'THREE_OPTIONS');
assert.strictEqual(classifyDecision({ risk: 'LOW', size: 'small', stuckAttempts: 1 }).mode, 'ASK_FOUNDER');
assert.strictEqual(classifyDecision({ risk: 'HIGH' }).options.length, 3);

assert.strictEqual(mergePolicy('LOW').mode, 'AUTO_MERGE');
assert.strictEqual(mergePolicy('HIGH').mode, 'PR_REVIEW_REQUIRED');

assert.deepStrictEqual(topThreeRisks(state), [
  'Swipe instability above zero risk.',
  'Typing confidence not fully verified yet.',
  'Symbol pain still exists.'
]);
assert.strictEqual(immediateAlerts(state).length, 5);

const digest = schoolModeDigest(state);
assert(digest.includes('7am school mode CTO update'));
assert(digest.includes('Main work today'));
assert(digest.includes('No major move'));

const group = groupChatDailyUpdate(state);
assert(group.includes('CTO:'));
assert(group.includes('CODER:'));
assert(group.includes('REVIEWER:'));
assert(group.includes('AUDITOR:'));

const roadmap = readRoadmap();
assert(roadmap.northStar.includes('By May 2027'));
assert(roadmap.vision.includes('A teenager in Chennai'));
assert(roadmap.currentPhase.includes('PHASE 1'));
assert(roadmapText.includes('NORTH STAR: By May 2027 when founder returns,'));
assert(roadmapText.includes('Full memory from June 4, never resets'));
assert(visionText.includes('Every line of code serves that teenager.'));

const beforeLogCount = readActionLog().actions.length;
const action = logAgentAction({
  agentName: 'TEST AGENT',
  actionTaken: 'verified trust layer',
  reason: 'Every action needs trace.',
  riskLevel: 'LOW',
  outcome: 'PASS'
});
assert(action.timestamp);
assert.strictEqual(action.agentName, 'TEST AGENT');
assert(readActionLog().actions.length >= beforeLogCount + 1);

const proposal = requestSpecialistSpawn({
  name: 'Keyboard Ergonomics Specialist',
  reason: 'Deep key-feel expertise needed.',
  task: 'Study thumb comfort and symbol friction.',
  duration: 'one focused cycle'
});
assert.strictEqual(proposal.status, 'PENDING_FOUNDER_APPROVAL');
assert(readSpawnState().pending);
const approved = answerSpecialistSpawn('YES');
assert.strictEqual(approved.status, 'APPROVED');
assert.strictEqual(approved.agent.reportsTo, 'CTO');

const oldMemory = {
  activeFocus: 'swipe reliability',
  unresolvedReference: 'typing confidence',
  schoolMemoryStartedAt: '2026-05-22T01:30:00.000Z',
  semanticFounderState: {
    activeFocus: 'swipe reliability',
    lastUpdatedAt: '2026-04-01T00:00:00.000Z'
  },
  lastUpdatedAt: '2026-04-01T00:00:00.000Z'
};
const stabilized = stabilizeSemanticMemory(oldMemory);
assert.strictEqual(stabilized.activeFocus, 'swipe reliability');
assert.strictEqual(stabilized.unresolvedReference, 'typing confidence');
assert(stabilized.semanticConflicts.includes('old_context_low_confidence'));
assert(stabilized.contextConfidence < 0.6);

const schoolResponse = routeMessage('school mode', state).response;
assert(schoolResponse.includes('SCHOOL MODE'));
assert(schoolResponse.includes('Health: 64/100'));
assert(schoolResponse.includes('Main work today'));
assert(schoolResponse.includes('CTO:'));
assert(schoolResponse.includes('CODER:'));

const spawnResponse = routeMessage('spawn visual hierarchy specialist for keyboard toolbar friction', state).response;
assert(spawnResponse.includes('Spawning:'));
assert(spawnResponse.includes('reply YES or NO'));
const spawnApproval = routeMessage('YES', state).response;
assert(spawnApproval.includes('Approved'));

const whatsappDaily = buildMessage(state);
assert(whatsappDaily.includes('CTO:'));
assert(whatsappDaily.includes('Immediate alerts:'));

assert(manual.includes('School Mode Intelligence'));
assert(manual.includes('Small things'));
assert(manual.includes('Big things'));
assert(manual.includes('Never resets'));

assert(workflow.includes("cron: '30 1 * * *'"));
assert(workflow.includes('Auto Merge Low-Risk PR'));
assert(workflow.includes('gh pr merge'));
assert(workflow.includes('Send Daily WhatsApp School Mode Report'));
assert(workflow.includes('TWILIO_ACCOUNT_SID'));

console.log('School mode intelligence checks passed.');
