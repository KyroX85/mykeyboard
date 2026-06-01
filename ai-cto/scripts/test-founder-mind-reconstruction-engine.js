const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-founder-mind-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-founder-mind-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-founder-mind-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-founder-mind-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-founder-mind-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-founder-mind-whatsapp-memory.json');

const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const {
  reconstructFounderMind,
  buildReflectionResponse,
  responseAnswersFounderMind,
  resolveContinuityReference
} = require('../whatsapp/founder-mind-reconstruction-engine');
const { readConversationMemory, updateMemory } = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder mind reconstruction test');

const forbiddenTemplates = /(Current Foundation Health|Recommended Next Step|Momentum:\s*STALLED|Health:\s*\d+|roadmap priority|Team is ready|Team Ready|complexity report|Task Plan|Review Gate|TASK_PLAN|APPROVE|Execution Plan|Files:|Validation:|Risk:\s*(LOW|MEDIUM|HIGH|CRITICAL)|Scope:)/i;

function route(text) {
  return routeMessage(text, {}, {});
}

function assertMindRoute(text, requiredPattern) {
  const result = route(text);
  const body = String(result.response || '');
  assert.strictEqual(result.command, 'founder_mind_reconstruction', text);
  assert.strictEqual(result.matchedRoute, 'founder_mind_reconstruction', text);
  assert.match(result.details.mode, /REFLECTION_MODE|FOUNDER_CONVERSATION_MODE/, text);
  assert(result.details.mindReconstruction.objective, text);
  assert(result.details.mindReconstruction.assumption, text);
  assert(result.details.mindReconstruction.concern, text);
  assert(result.details.mindReconstruction.decision, text);
  assert(result.details.mindReconstruction.desiredOutcome, text);
  assert(result.details.mindReconstruction.actualQuestion, text);
  assert.match(body, requiredPattern, text);
  assert.doesNotMatch(body, forbiddenTemplates, text);
  assert.doesNotMatch(body, /Mind reconstruction:\nObjective:/, text);
  assert.doesNotMatch(body, /NOISE|AMBIGUOUS INTENT|LOW INFORMATION/, text);
  return result;
}

assertMindRoute(
  'Why am I asking this question?',
  /reason behind your words|assumption being tested|worry underneath/i
);

assertMindRoute(
  'What assumption am I testing?',
  /assumption being tested/i
);

assertMindRoute(
  'What am I worried about?',
  /worry underneath|template selector/i
);

assertMindRoute(
  'Do my agents understand the project?',
  /not asking for a project summary|understand fragments|evidence proves understanding/i
);

assertMindRoute(
  "What's happening?",
  /context-aware|health report|awareness/i
);

const dream = assertMindRoute(
  'Bro are we even moving toward the dream?',
  /Partially|dream|personal intelligence layer|infrastructure|aligned/i
);
assert.strictEqual(dream.details.category, 'VISION');
assert.strictEqual(dream.details.mode, 'FOUNDER_CONVERSATION_MODE');
assert.match(dream.details.mindReconstruction.actualQuestion, /long-term Aritenis dream|agents look busy/i);

const dissatisfaction = assertMindRoute(
  'Bro why am I not satisfied with this feature?',
  /meaningful user outcome|value gap|hidden concern|technically works/i
);
assert.strictEqual(dissatisfaction.details.category, 'REFLECTION');
assert.match(dissatisfaction.details.mindReconstruction.concern, /mechanically|meaningful user outcome|strategic differentiation/i);

const wrongFocus = assertMindRoute(
  "Bro I think we're focusing on the wrong thing.",
  /worried.*infrastructure|killer feature|misalignment|founder objective|strategic discussion/i
);
assert.strictEqual(wrongFocus.details.category, 'DOUBT');
assert.strictEqual(wrongFocus.details.mode, 'FOUNDER_CONVERSATION_MODE');
assert.match(wrongFocus.details.mindReconstruction.concern, /look operational|product moment|users would actually care/i);
assert.doesNotMatch(String(wrongFocus.response || ''), /TASK_PLAN|APPROVE|Execution Plan|Files:|Validation:|Risk:|Scope:/i);
updateMemory(wrongFocus.command, {}, {
  ...(wrongFocus.details || {}),
  founderMessage: "Bro I think we're focusing on the wrong thing.",
  agentAnswer: wrongFocus.response
});
const continuityMemory = readConversationMemory();
assert(continuityMemory.lastFounderConcern);
assert(continuityMemory.lastFounderConcern.decision);
assert(continuityMemory.founderDoubts.length >= 1);
assert(continuityMemory.founderDoubts[0].decision);
const resolvedThat = resolveContinuityReference('Did we fix that?', continuityMemory);
assert(resolvedThat);
assert.match(resolvedThat.concern, /look operational|product moment|users would actually care/i);
const followUp = routeMessage('Did we fix that?', {}, continuityMemory);
assert.strictEqual(followUp.command, 'founder_mind_reconstruction');
assert.strictEqual(followUp.details.category, 'STRATEGIC_DISCUSSION');
assert.match(followUp.response, /that.*previous concern|partially addressed|what remains/i);
assert.doesNotMatch(String(followUp.response || ''), /TASK_PLAN|APPROVE|Execution Plan|Files:|Validation:|Risk:|Scope:/i);

const chasing = assertMindRoute(
  "Bro what do you think I'm actually chasing?",
  /personal intelligence layer|phone|keyboard|screenshots|trust|leverage|miss if it disappeared/i
);
assert.strictEqual(chasing.details.category, 'FOUNDER_QUESTION');
assert.strictEqual(chasing.details.mode, 'FOUNDER_CONVERSATION_MODE');
assert.match(chasing.details.mindReconstruction.actualQuestion, /long-term outcome|Aritenis/i);
assert.doesNotMatch(String(chasing.response || ''), /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution/i);

const disagreement = assertMindRoute(
  'Bro, if you had to disagree with me right now, what would you disagree with?',
  /disagree|agent sophistication|user-facing product moment|Phase 2 wedge|Explain/i
);
assert.strictEqual(disagreement.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(disagreement.details.intent, 'RECONSTRUCT_STRATEGIC_DISAGREEMENT');
assert.match(disagreement.details.mindReconstruction.concern, /infrastructure|user-facing product proof/i);
assert.doesNotMatch(String(disagreement.response || ''), /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|Files:|Validation:|Scope:/i);

const founderEvolution = assertMindRoute(
  'Am I the same founder I was 3 months ago?',
  /not the same founder|3 months ago|fake progress|product-truth mode|user-facing breakthrough/i
);
assert.strictEqual(founderEvolution.details.category, 'REFLECTION');
assert.strictEqual(founderEvolution.details.intent, 'RECONSTRUCT_FOUNDER_EVOLUTION');
assert.match(founderEvolution.details.mindReconstruction.actualQuestion, /changed as a founder|helping or hurting Aritenis/i);
assert.doesNotMatch(String(founderEvolution.response || ''), /NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const userValueDoubt = assertMindRoute(
  "I don't think users actually care.",
  /real risk|users will not care|frequent moment of confusion|understand a screenshot|less friction|users may care/i
);
assert.strictEqual(userValueDoubt.details.category, 'DOUBT');
assert.strictEqual(userValueDoubt.details.intent, 'RECONSTRUCT_USER_VALUE_DOUBT');
assert.match(userValueDoubt.details.mindReconstruction.actualQuestion, /real users care|change behavior/i);
assert.doesNotMatch(String(userValueDoubt.response || ''), /NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const impressiveFear = assertMindRoute(
  "I'm scared we're building something impressive instead of useful.",
  /fear is valid|impressive and still fail|real user struggle|understand confusing content|faster, clearer, or more confident/i
);
assert.strictEqual(impressiveFear.details.category, 'DOUBT');
assert.strictEqual(impressiveFear.details.intent, 'RECONSTRUCT_IMPRESSIVE_NOT_USEFUL_FEAR');
assert.match(impressiveFear.details.mindReconstruction.actualQuestion, /users need|looks impressive/i);
assert.doesNotMatch(String(impressiveFear.response || ''), /NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const failurePremortem = assertMindRoute(
  'If we fail in 3 years, why do we fail?',
  /fails in 3 years|user habit|Explain never becomes a daily need|trust erosion|behaviorally optional|repeatable moment/i
);
assert.strictEqual(failurePremortem.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(failurePremortem.details.intent, 'RECONSTRUCT_LONG_TERM_FAILURE_PREMORTEM');
assert.match(failurePremortem.details.mindReconstruction.actualQuestion, /fails in 3 years|strategic mistake/i);
assert.doesNotMatch(String(failurePremortem.response || ''), /CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const behaviorOptimization = assertMindRoute(
  'Forget what I say.\n\nBased on my behavior, what am I optimizing for?',
  /product truth|stress-testing the agents|fake progress|leverage|useful breakthrough|trustworthy/i
);
assert.strictEqual(behaviorOptimization.details.category, 'REFLECTION');
assert.strictEqual(behaviorOptimization.details.intent, 'RECONSTRUCT_FOUNDER_BEHAVIOR_OPTIMIZATION');
assert.match(behaviorOptimization.details.mindReconstruction.actualQuestion, /behavior.*optimize|repeated behavior/i);
assert.doesNotMatch(String(behaviorOptimization.response || ''), /CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const dreamValidity = assertMindRoute(
  'Bro, what if my dream itself is wrong?',
  /dream might be wrong|underlying desire|keyboard is automatically the right vehicle|Explain is the current smallest test|user behavior decide/i
);
assert.strictEqual(dreamValidity.details.category, 'VISION');
assert.strictEqual(dreamValidity.details.intent, 'RECONSTRUCT_DREAM_VALIDITY_DOUBT');
assert.match(dreamValidity.details.mindReconstruction.actualQuestion, /dream itself wrong|current path.*unproven/i);
assert.doesNotMatch(String(dreamValidity.response || ''), /wrong response path|CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const reconstructed = reconstructFounderMind('Why did I ask that?', {});
assert.strictEqual(reconstructed.mode, 'REFLECTION_MODE');
assert.strictEqual(reconstructed.intent, 'RECONSTRUCT_FOUNDER_META_REASONING');
assert(responseAnswersFounderMind(reconstructed));
assert(reconstructed.report.uselessLiteralAnswer.includes('status'));
assert(reconstructed.confidence <= 90);
const normalReflection = buildReflectionResponse(reconstructed);
const debugReflection = buildReflectionResponse(reconstructed, { debug: true });
assert.doesNotMatch(normalReflection, /Mind reconstruction:|Decision:/i);
assert.match(debugReflection, /Mind reconstruction:/i);
assert.match(debugReflection, /Decision:/i);

(async () => {
  const withAi = await routeMessageWithAi('Why am I asking this question?', {}, {});
  assert.strictEqual(withAi.matchedRoute, 'founder_mind_reconstruction');
  assert.strictEqual(withAi.usedAi, false);
  assert.strictEqual(withAi.aiReason, 'founder_mind_reconstruction');
  assert.doesNotMatch(String(withAi.response || ''), forbiddenTemplates);
  console.log('Founder mind reconstruction engine checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
