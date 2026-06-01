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
  responseAnswersFounderMind
} = require('../whatsapp/founder-mind-reconstruction-engine');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'founder mind reconstruction test');

const forbiddenTemplates = /(Current Foundation Health|Recommended Next Step|Momentum:\s*STALLED|Health:\s*\d+|roadmap priority|Team is ready|Team Ready|complexity report|Task Plan|Review Gate|TASK_PLAN|APPROVE|Execution Plan|Execution\b|Files:|Validation:|Risk:|Scope:)/i;

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

const chasing = assertMindRoute(
  "Bro what do you think I'm actually chasing?",
  /personal intelligence layer|phone|keyboard|screenshots|trust|leverage|miss if it disappeared/i
);
assert.strictEqual(chasing.details.category, 'FOUNDER_QUESTION');
assert.strictEqual(chasing.details.mode, 'FOUNDER_CONVERSATION_MODE');
assert.match(chasing.details.mindReconstruction.actualQuestion, /long-term outcome|Aritenis/i);
assert.doesNotMatch(String(chasing.response || ''), /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution/i);

const reconstructed = reconstructFounderMind('Why did I ask that?', {});
assert.strictEqual(reconstructed.mode, 'REFLECTION_MODE');
assert.strictEqual(reconstructed.intent, 'RECONSTRUCT_FOUNDER_META_REASONING');
assert(responseAnswersFounderMind(reconstructed));
assert(reconstructed.report.uselessLiteralAnswer.includes('status'));
assert(reconstructed.confidence <= 90);

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
