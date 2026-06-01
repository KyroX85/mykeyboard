const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-meta-learning-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-meta-learning-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-meta-learning-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-meta-learning-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-meta-learning-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-meta-learning-whatsapp-memory-${Date.now()}.json`);

const {
  analyzeMetaLearning,
  updateMetaLearningMemory
} = require('../meta-learning-layer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

const memory = {
  routeScores: {
    founder_mind_reconstruction: { score: 8, positive: 6, negative: 1, confidence: 0.9 },
    evidence_requirement_layer: { score: 4, positive: 3, negative: 0, confidence: 0.7 },
    generic_status_template: { score: -5, positive: 0, negative: 4, confidence: 0.8 },
    stale_extra_layer: { score: 0, positive: 0, negative: 0, confidence: 0 }
  },
  founderFeedback: [
    { feedback: 'good_answer', polarity: 'positive', adaptation: 'preserve_direct_reasoning', answerPattern: 'founder mind reconstruction answered the concern' },
    { feedback: 'not_relevant', polarity: 'negative', adaptation: 'answer_actual_question_first', answerPattern: 'generic status template' },
    { feedback: 'too_much_cto_mode', polarity: 'negative', adaptation: 'stay_conversational', answerPattern: 'health momentum template' }
  ],
  wrongAnswerAnalysis: {
    failureCounts: {
      wrong_route: 4,
      wrong_tone: 3
    },
    recentFailures: [
      { primaryFailureReason: 'wrong_route', answerPattern: 'generic status template', evidence: ['status artifacts leaked'] }
    ]
  },
  evidenceRequirementMemory: {
    recentChecks: [
      { status: 'EVIDENCE_SUPPORTED', claimPreview: 'founder mind reconstruction was supported', evidence: { memory: ['goal'], conversation: ['question'], behavior: ['feedback'] } },
      { status: 'DOWNGRADE_REQUIRED', claimPreview: 'generic status claim lacked evidence', evidence: { memory: [], conversation: [], behavior: [] } }
    ]
  },
  routeEvolutionMemory: {
    lastAnalysis: {
      strongRoutes: [{ routeKey: 'founder_mind_reconstruction', accuracy: 0.86, sampleCount: 7 }],
      weakRoutes: [{ routeKey: 'generic_status_template', accuracy: 0.0, sampleCount: 4 }],
      recommendations: ['Merge weak fallback routes into founder thinking routes.']
    }
  }
};

const analysis = analyzeMetaLearning(memory);
assert(analysis.highValueLayers.some((layer) => layer.layerKey === 'founder_mind_reconstruction'));
assert(analysis.highValueLayers.some((layer) => layer.layerKey === 'evidence_requirement_layer'));
assert(analysis.lowValueLayers.some((layer) => layer.layerKey === 'generic_status_template'));
assert(analysis.lowValueLayers.some((layer) => layer.layerKey === 'stale_extra_layer'));
assert(analysis.outcomeChanges.some((item) => /founder_mind_reconstruction/.test(item.layerKey)));
assert(analysis.unnoticedLayers.some((layer) => layer.layerKey === 'stale_extra_layer'));
assert(analysis.recommendations.some((item) => item.action === 'STRENGTHEN'));
assert(analysis.recommendations.some((item) => item.action === 'REMOVE_CANDIDATE'));
assert(analysis.removalSafety.every((item) => item.requiresFounderApproval === true));
assert(analysis.confidence <= 90);

let metaMemory = updateMetaLearningMemory(null, analysis);
metaMemory = updateMetaLearningMemory(metaMemory, analysis);
assert.strictEqual(metaMemory.analysisHistory.length, 2);
assert.strictEqual(metaMemory.lastAnalysis.version, '1.0');
assert(metaMemory.lastAnalysis.recommendations.length > 0);

updateMemory('founder_feedback_recorded', {}, {
  founderMessage: 'good answer',
  agentAnswer: 'Founder mind reconstruction gave a useful answer.',
  metaLearningAnalysis: analysis
});

const stored = readConversationMemory();
assert(stored.metaLearningMemory);
assert(stored.metaLearningMemory.lastAnalysis.highValueLayers.length > 0);
assert(stored.metaLearningMemory.lastAnalysis.lowValueLayers.length > 0);

console.log('Meta learning layer checks passed.');
