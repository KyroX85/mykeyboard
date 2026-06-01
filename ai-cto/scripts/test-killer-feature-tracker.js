const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-killer-feature-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-killer-feature-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-killer-feature-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-killer-feature-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-killer-feature-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-killer-feature-whatsapp-memory-${Date.now()}.json`);

const {
  shouldTrackKillerFeature,
  scoreKillerFeature,
  applyKillerFeatureTrackerToRoute,
  updateKillerFeatureMemory
} = require('../killer-feature-tracker');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

assert.strictEqual(shouldTrackKillerFeature('Should we build Explain for confusing screenshots users see daily?'), true);
assert.strictEqual(shouldTrackKillerFeature('hi'), false);

const explain = scoreKillerFeature('Build Explain for confusing screenshots, bills, forms, and messages inside the keyboard every day.');
assert(explain.habitPotential.score >= 70);
assert(explain.frequency.score >= 70);
assert(explain.painRemoved.score >= 70);
assert.strictEqual(explain.classification, 'KILLER_FEATURE_CANDIDATE');
assert.match(explain.recommendation, /prototype|validate|daily/i);

const oneOff = scoreKillerFeature('Create a beautiful settings theme picker with premium gradients.');
assert(oneOff.totalScore < 55);
assert.strictEqual(oneOff.classification, 'WEAK_HABIT_POTENTIAL');
assert.match(oneOff.recommendation, /do not prioritize/i);

const route = applyKillerFeatureTrackerToRoute({
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: 'This sounds useful.'
}, {
  message: 'Should we add a beautiful theme picker?'
});
assert.match(route.response, /Killer feature check/i);
assert.match(route.response, /Habit Potential/i);
assert.strictEqual(route.details.killerFeatureScore.classification, 'WEAK_HABIT_POTENTIAL');

const strongRoute = applyKillerFeatureTrackerToRoute({
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: 'Explain may become the wedge.'
}, {
  message: 'What if Explain screenshots becomes a daily habit for confusing school and work messages?'
});
assert.doesNotMatch(strongRoute.response, /Weak habit/i);
assert.strictEqual(strongRoute.details.killerFeatureScore.classification, 'KILLER_FEATURE_CANDIDATE');

let memory = updateKillerFeatureMemory(null, explain);
memory = updateKillerFeatureMemory(memory, oneOff);
assert.strictEqual(memory.recentCandidates.length, 2);
assert.strictEqual(memory.killerCandidateCount, 1);
assert.strictEqual(memory.weakHabitCount, 1);
assert.strictEqual(memory.topCandidate.classification, 'KILLER_FEATURE_CANDIDATE');

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'What if Explain screenshots becomes a daily habit for confusing school and work messages?',
  agentAnswer: 'This may be the wedge.'
});

const stored = readConversationMemory();
assert(stored.killerFeatureMemory);
assert.strictEqual(stored.killerFeatureMemory.topCandidate.classification, 'KILLER_FEATURE_CANDIDATE');

console.log('Killer feature tracker checks passed.');
