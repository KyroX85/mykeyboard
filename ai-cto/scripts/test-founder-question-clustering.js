const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-question-cluster-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-question-cluster-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-question-cluster-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-question-cluster-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-question-cluster-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-question-cluster-whatsapp-memory-${Date.now()}.json`);

const {
  classifyFounderQuestionCluster,
  updateFounderQuestionClusters
} = require('../founder-question-clustering');
const { routeMessage } = require('../whatsapp/command-router');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder question clustering test');

const dream = classifyFounderQuestionCluster('Bro are we even moving toward the dream?');
assert.strictEqual(dream.clusterId, 'DREAM_QUESTIONS');
assert.strictEqual(dream.family, 'dream questions');
assert(dream.confidence >= 80);

const strategy = classifyFounderQuestionCluster('What happens if we focus only on the execution layer for 6 months?');
assert.strictEqual(strategy.clusterId, 'STRATEGY_QUESTIONS');

const premortem = classifyFounderQuestionCluster('If we fail in 3 years, why do we fail?');
assert.strictEqual(premortem.clusterId, 'PREMORTEM_QUESTIONS');

const reflection = classifyFounderQuestionCluster('Forget what I say. Based on my behavior, what am I optimizing for?');
assert.strictEqual(reflection.clusterId, 'REFLECTION_QUESTIONS');

const value = classifyFounderQuestionCluster("I don't think users actually care.");
assert.strictEqual(value.clusterId, 'USER_VALUE_QUESTIONS');

let clusters = updateFounderQuestionClusters(null, {
  message: 'Should this be a wedge or a trap?',
  category: 'FOUNDER_STRATEGY',
  intent: 'RECONSTRUCT_WEDGE_TRAP',
  confidence: 64
});
assert(clusters.learnedClusters.length >= 1);
assert.match(clusters.learnedClusters[0].clusterId, /^LEARNED_FOUNDER_STRATEGY_/);

clusters = updateFounderQuestionClusters(clusters, {
  message: 'Should this be a wedge or a trap?',
  category: 'FOUNDER_STRATEGY',
  intent: 'RECONSTRUCT_WEDGE_TRAP',
  confidence: 64
});
assert.strictEqual(clusters.learnedClusters.length, 1);
assert.strictEqual(clusters.learnedClusters[0].count, 2);

const question = 'Bro are we even moving toward the dream?';
const routed = routeMessage(question, {}, readConversationMemory());
assert.strictEqual(routed.command, 'founder_mind_reconstruction');
assert(routed.details.questionCluster);
assert.strictEqual(routed.details.questionCluster.clusterId, 'DREAM_QUESTIONS');
assert.doesNotMatch(routed.response, /TASK_PLAN|APPROVE|Health:\s*\d+|Momentum/i);

updateMemory(routed.command, {}, {
  ...(routed.details || {}),
  founderMessage: question,
  agentAnswer: routed.response
});

const memory = readConversationMemory();
assert(memory.founderQuestionClusters);
assert(memory.founderQuestionClusters.clusters.DREAM_QUESTIONS.count >= 1);
assert.strictEqual(memory.founderQuestionClusters.recentQuestions[0].clusterId, 'DREAM_QUESTIONS');

console.log('Founder question clustering checks passed.');
