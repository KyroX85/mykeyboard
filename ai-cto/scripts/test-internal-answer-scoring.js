const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-answer-scoring-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-answer-scoring-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-answer-scoring-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-answer-scoring-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-answer-scoring-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-answer-scoring-memory-${Date.now()}.json`);

const {
  scoreInternalAnswer,
  enforceInternalAnswerQuality,
  updateAnswerQualityMemory,
  selectHighScoringAnswerExamples
} = require('../internal-answer-scoring');
const { routeMessage } = require('../whatsapp/command-router');
const {
  readConversationMemory,
  updateMemory
} = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'internal answer scoring test');

const weak = scoreInternalAnswer({
  message: 'Bro are we moving toward the dream?',
  response: 'CTO: Team is ready.\nHealth 30/100\nMomentum: STALLED',
  route: { command: 'agent', details: { intent: 'summary' } }
});

assert(weak.total < 25);
assert.strictEqual(weak.shouldRegenerate, true);
assert(weak.scores.founderRelevance <= 4);
assert(weak.scores.templateContamination <= 3);
assert(weak.scores.specificity <= 4);
assert(weak.scores.truthfulness <= 5);
assert(weak.scores.usefulness <= 4);
assert(weak.scores.strategicDepth <= 4);

const repaired = enforceInternalAnswerQuality({
  command: 'agent',
  details: { intent: 'bad_route' },
  response: 'CTO: Team is ready.\nHealth 30/100\nMomentum: STALLED'
}, {
  message: 'Bro are we moving toward the dream?',
  memory: {}
});

assert.strictEqual(repaired.details.internalAnswerScoring.regenerated, true);
assert(repaired.details.internalAnswerScoring.total >= 25);
assert(repaired.details.internalAnswerScoring.scores.specificity >= 5);
assert(repaired.details.internalAnswerScoring.scores.founderRelevance >= 5);
assert(repaired.details.internalAnswerScoring.scores.truthfulness >= 5);
assert(repaired.details.internalAnswerScoring.scores.usefulness >= 5);
assert(repaired.details.internalAnswerScoring.scores.strategicDepth >= 5);
assert(repaired.details.internalAnswerScoring.scores.templateContamination >= 8);
assert.match(repaired.response, /dream|user value|current direction/i);
assert.doesNotMatch(repaired.response, /Health 30|Momentum|Team is ready/i);

const strong = enforceInternalAnswerQuality({
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: 'Partially. We are closer on governance and evidence, but the user-facing Explain wedge still needs proof through repeated screenshot-use moments.'
}, {
  message: 'Bro are we moving toward the dream?',
  memory: {}
});

assert.strictEqual(strong.details.internalAnswerScoring.regenerated, false);
assert.match(strong.response, /Partially/);

let answerQualityMemory = updateAnswerQualityMemory(null, {
  message: 'Bro are we moving toward the dream?',
  response: strong.response,
  route: strong,
  scoring: strong.details.internalAnswerScoring
});
answerQualityMemory = updateAnswerQualityMemory(answerQualityMemory, {
  message: 'Bro are we moving toward the dream?',
  response: 'Current Foundation Health: protected.\nRecommended Next Step: continue.',
  route: { command: 'founder_mind_reconstruction' },
  scoring: scoreInternalAnswer({
    message: 'Bro are we moving toward the dream?',
    response: 'Current Foundation Health: protected.\nRecommended Next Step: continue.',
    route: { command: 'founder_mind_reconstruction' }
  })
});
assert(answerQualityMemory.history.length >= 2);
assert(answerQualityMemory.bestExamples.length >= 1);
assert.strictEqual(answerQualityMemory.bestExamples[0].routeKey, 'founder_mind_reconstruction');
assert.match(answerQualityMemory.bestExamples[0].responsePreview, /Partially|Explain|proof/i);

const examples = selectHighScoringAnswerExamples('Are we moving toward the dream?', {
  answerQualityMemory
});
assert(examples.length >= 1);
assert.match(examples[0].responsePreview, /Partially|Explain|proof/i);

const routed = routeMessage('Bro are we moving toward the dream?', {}, {});
assert(routed.details.internalAnswerScoring);
assert(routed.details.internalAnswerScoring.total >= 25);
assert.doesNotMatch(routed.response, /Health\s*:?\s*\d{1,3}|Momentum|Team is ready/i);

updateMemory(routed.command, {}, {
  ...(routed.details || {}),
  founderMessage: 'Bro are we moving toward the dream?',
  agentAnswer: routed.response
});
const storedMemory = readConversationMemory();
assert(storedMemory.answerQualityMemory);
assert(storedMemory.answerQualityMemory.history.length >= 1);
assert(storedMemory.answerQualityMemory.bestExamples.length >= 1);
assert.match(storedMemory.answerQualityMemory.bestExamples[0].responsePreview, /dream|Explain|user/i);

console.log('Internal answer scoring checks passed.');
