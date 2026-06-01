const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-route-evolution-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-route-evolution-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-route-evolution-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-route-evolution-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-route-evolution-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-route-evolution-whatsapp-memory-${Date.now()}.json`);

const {
  analyzeRouteEvolution,
  updateRouteEvolutionMemory
} = require('../route-evolution-layer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

const memory = {
  routeScores: {
    founder_mind_reconstruction: { score: 7, positive: 5, negative: 0, confidence: 0.8 },
    conversational_fallback: { score: -5, positive: 0, negative: 4, confidence: 0.77 },
    agent: { score: -4, positive: 1, negative: 5, confidence: 0.82 },
    product_lab_screenshot_workflow: { score: 3, positive: 3, negative: 1, confidence: 0.7 }
  },
  reinforcementEvents: [
    { routeKey: 'conversational_fallback', reward: -2, rewardLabel: 'founder_wrong' },
    { routeKey: 'agent', reward: -2, rewardLabel: 'founder_not_relevant' },
    { routeKey: 'founder_mind_reconstruction', reward: 2, rewardLabel: 'founder_correct' }
  ],
  founderQuestionClusters: {
    clusters: {
      DREAM_QUESTIONS: { count: 6, family: 'dream questions', category: 'VISION' },
      STRATEGY_QUESTIONS: { count: 7, family: 'strategy questions', category: 'FOUNDER_STRATEGY' },
      USER_VALUE_QUESTIONS: { count: 5, family: 'user value questions', category: 'DOUBT' }
    },
    learnedClusters: [
      {
        clusterId: 'LEARNED_MISSING_KILLER_FEATURE',
        family: 'missing killer feature questions',
        category: 'FOUNDER_STRATEGY',
        count: 4,
        tokens: ['killer', 'feature', 'missing', 'users']
      }
    ]
  }
};

const analysis = analyzeRouteEvolution(memory);
assert(analysis.routeAccuracy.founder_mind_reconstruction.accuracy >= 0.8);
assert(analysis.weakRoutes.some((route) => route.routeKey === 'conversational_fallback'));
assert(analysis.mergeSuggestions.some((item) => /conversational_fallback|agent/.test(item.routes.join(' '))));
assert(analysis.splitSuggestions.some((item) => item.routeKey === 'founder_mind_reconstruction'));
assert(analysis.newRouteSuggestions.some((item) => item.clusterId === 'LEARNED_MISSING_KILLER_FEATURE'));
assert(analysis.recommendations.length > 0);

let routeEvolutionMemory = updateRouteEvolutionMemory(null, analysis);
assert.strictEqual(routeEvolutionMemory.lastAnalysis.weakRoutes.length >= 1, true);
assert.strictEqual(routeEvolutionMemory.analysisHistory.length, 1);

updateMemory('founder_feedback_recorded', {}, {
  founderMessage: 'wrong',
  agentAnswer: 'The previous route was not relevant.',
  routeEvolutionAnalysis: analysis
});

const stored = readConversationMemory();
assert(stored.routeEvolutionMemory);
assert(stored.routeEvolutionMemory.lastAnalysis.newRouteSuggestions.length > 0);
assert(stored.routeEvolutionMemory.lastAnalysis.mergeSuggestions.length > 0);

console.log('Route evolution layer checks passed.');
