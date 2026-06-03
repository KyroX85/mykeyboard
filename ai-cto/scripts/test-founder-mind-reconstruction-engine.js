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
const { responseUsesPremortemAnalysis } = require('../premortem-engine');
const { responseUsesAdvisorMode } = require('../advisor-mode');
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
const reflectionFirewallForbidden = /(Memory Sources Used|Route Confidence|Route Reason|CTO:|CODER|REVIEWER|AUDITOR|repo scan|health|momentum|task plan|blockers|files:|risk report|commits?|auditor output|reviewer output|CTO status|diagnostic|previous answer|self[-\s]?evaluation|keyboard implementation|product implementation|TASK_PLAN|APPROVE|Execution Plan)/i;

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

function assertReflectionFirewall(text, requiredPattern) {
  const result = assertMindRoute(text, requiredPattern);
  const body = String(result.response || '');
  assert.strictEqual(result.details.founderReflectionFirewall, true, text);
  assert.strictEqual(result.details.suppressMemorySources, true, text);
  assert.doesNotMatch(body, reflectionFirewallForbidden, text);
  const sentences = body
    .replace(/\n+/g, ' ')
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  assert(sentences.length >= 3 && sentences.length <= 8, `${text}: sentence count ${sentences.length}`);
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
assert(responseUsesAdvisorMode(dream.response));

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
assert(responseUsesAdvisorMode(wrongFocus.response));
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

const jarvisBuildReason = assertMindRoute(
  'Why am I building Jarvis?',
  /burden humans carry alone|humans choose direction|Jarvis carries effort|trust matters more than raw capability/i
);
assert.strictEqual(jarvisBuildReason.details.category, 'VISION');
assert.strictEqual(jarvisBuildReason.details.intent, 'RECONSTRUCT_JARVIS_BUILD_REASON');
assert.strictEqual(jarvisBuildReason.details.directFounderVision, true);
assert.match(jarvisBuildReason.details.mindReconstruction.actualQuestion, /Jarvis matter|founder dream/i);
assert.doesNotMatch(String(jarvisBuildReason.response || ''), /Memory Sources Used|Route Confidence|Dream alignment|Dream drift alert|Advisor Mode|Strategic read|CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|conversational_fallback/i);

const jarvisVisionRole = assertMindRoute(
  'What role does Jarvis play in the vision?',
  /burden-carrying intelligence layer|keyboard, screenshots, and messages|human direction stays sacred|understanding, memory, preparation, and effort/i
);
assert.strictEqual(jarvisVisionRole.details.category, 'VISION');
assert.strictEqual(jarvisVisionRole.details.intent, 'RECONSTRUCT_JARVIS_VISION_ROLE');
assert.strictEqual(jarvisVisionRole.details.directFounderVision, true);
assert.match(jarvisVisionRole.details.mindReconstruction.actualQuestion, /job does Jarvis perform|Aritenis vision/i);
assert.doesNotMatch(String(jarvisVisionRole.response || ''), /Memory Sources Used|Route Confidence|Dream alignment|Dream drift alert|Advisor Mode|Strategic read|CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|conversational_fallback/i);

const diamondBronze = assertMindRoute(
  "Claude says I already have the diamond and I'm searching for bronze. Is he right?",
  /mostly yes|diamond is.*founder vision|bronze is.*routing fixes|easier to verify|product moment users actually repeat/i
);
assert.strictEqual(diamondBronze.details.category, 'FOUNDER_QUESTION');
assert.strictEqual(diamondBronze.details.intent, 'RECONSTRUCT_DIAMOND_BRONZE_METAPHOR');
assert.strictEqual(diamondBronze.details.directFounderVision, true);
assert.match(diamondBronze.details.mindReconstruction.actualQuestion, /valuable vision|smaller, less important work/i);
assert.doesNotMatch(String(diamondBronze.response || ''), /Memory Sources Used|Route Confidence|Dream alignment|Advisor Mode|Strategic read|COMMAND: agent|TASK_PLAN|planning_request|Health|Momentum|Team Ready|Execution Plan|Attempted:|Blocked:|Next:/i);

const disagreement = assertMindRoute(
  'Bro, if you had to disagree with me right now, what would you disagree with?',
  /disagree|agent sophistication|user-facing product moment|Phase 2 wedge|Explain/i
);
assert.strictEqual(disagreement.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(disagreement.details.intent, 'RECONSTRUCT_STRATEGIC_DISAGREEMENT');
assert.match(disagreement.details.mindReconstruction.concern, /infrastructure|user-facing product proof/i);
assert.doesNotMatch(String(disagreement.response || ''), /TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|Files:|Validation:|Scope:/i);
assert(responseUsesAdvisorMode(disagreement.response));

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

const shortUserValueDoubt = assertMindRoute(
  "I think users don't care.",
  /real risk|users will not care|frequent moment of confusion|understand a screenshot|less friction|users may care/i
);
assert.strictEqual(shortUserValueDoubt.details.category, 'DOUBT');
assert.strictEqual(shortUserValueDoubt.details.intent, 'RECONSTRUCT_USER_VALUE_DOUBT');
assert.doesNotMatch(String(shortUserValueDoubt.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const missingBlindSpot = assertMindRoute(
  'What am I missing?',
  /killer feature|user pull|Explain|blind spot|evidence/i
);
assert.strictEqual(missingBlindSpot.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(missingBlindSpot.details.intent, 'RECONSTRUCT_MISSING_BLIND_SPOT');
assert(responseUsesPremortemAnalysis(missingBlindSpot.response));
assert.doesNotMatch(String(missingBlindSpot.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const dangerousAssumption = assertMindRoute(
  "What's the most dangerous assumption?",
  /dangerous assumption|users.*care|Explain|daily habit|evidence/i
);
assert.strictEqual(dangerousAssumption.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(dangerousAssumption.details.intent, 'RECONSTRUCT_DANGEROUS_ASSUMPTION');
assert(responseUsesPremortemAnalysis(dangerousAssumption.response));
assert(responseUsesAdvisorMode(dangerousAssumption.response));
assert.doesNotMatch(String(dangerousAssumption.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

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
assert(responseUsesPremortemAnalysis(failurePremortem.response));
assert.match(failurePremortem.response, /Most likely failure:|Hidden failure:|Ignored failure:|Founder-caused failure:/i);
assert.match(failurePremortem.details.mindReconstruction.actualQuestion, /fails in 3 years|strategic mistake/i);
assert.doesNotMatch(String(failurePremortem.response || ''), /CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const whatKillsUs = assertMindRoute(
  'What kills us?',
  /kills us|infrastructure|user habit|optional|killer feature|distribution/i
);
assert.strictEqual(whatKillsUs.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(whatKillsUs.details.intent, 'RECONSTRUCT_COMPANY_KILL_RISK');
assert(responseUsesPremortemAnalysis(whatKillsUs.response));
assert.doesNotMatch(String(whatKillsUs.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const whatKillsAritenis = assertMindRoute(
  'What kills Aritenis?',
  /kills us|infrastructure|user habit|optional|killer feature|distribution/i
);
assert.strictEqual(whatKillsAritenis.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(whatKillsAritenis.details.intent, 'RECONSTRUCT_COMPANY_KILL_RISK');
assert(responseUsesPremortemAnalysis(whatKillsAritenis.response));
assert.doesNotMatch(String(whatKillsAritenis.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|anti_template_conversation_guard/i);

const whyWillWeFail = assertMindRoute(
  'Why will we fail?',
  /fails in 3 years|user habit|Explain never becomes a daily need|trust erosion|behaviorally optional|repeatable moment/i
);
assert.strictEqual(whyWillWeFail.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(whyWillWeFail.details.intent, 'RECONSTRUCT_LONG_TERM_FAILURE_PREMORTEM');
assert(responseUsesPremortemAnalysis(whyWillWeFail.response));
assert.doesNotMatch(String(whyWillWeFail.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|anti_template_conversation_guard/i);

const freedomJarvisContradiction = assertMindRoute(
  'I want humans to be free, but I want Jarvis to do everything. What contradiction do you see?',
  /freedom|dependency|humans choose direction|AI executes|outsourcing judgment|contradiction/i
);
assert.strictEqual(freedomJarvisContradiction.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(freedomJarvisContradiction.details.intent, 'RECONSTRUCT_FREEDOM_JARVIS_CONTRADICTION');
assert.doesNotMatch(String(freedomJarvisContradiction.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const freedomSystemsContradiction = assertMindRoute(
  'I want freedom but I keep building systems. What contradiction do you see?',
  /machinery that frees people from machinery|humans keep direction|agency|serves freedom/i
);
assert.strictEqual(freedomSystemsContradiction.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(freedomSystemsContradiction.details.intent, 'RECONSTRUCT_FREEDOM_SYSTEMS_CONTRADICTION');
assert.doesNotMatch(String(freedomSystemsContradiction.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|anti_template_conversation_guard/i);

const machineryFreedomContradiction = assertMindRoute(
  'I want humans free from machinery but I build machinery. Explain.',
  /machinery that frees people from machinery|carry burden|agency|replaces agency/i
);
assert.strictEqual(machineryFreedomContradiction.details.category, 'FOUNDER_STRATEGY');
assert.strictEqual(machineryFreedomContradiction.details.intent, 'RECONSTRUCT_FREEDOM_SYSTEMS_CONTRADICTION');
assert.doesNotMatch(String(machineryFreedomContradiction.response || ''), /CLARIFICATION_REQUEST|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan|anti_template_conversation_guard/i);

const behaviorOptimization = assertMindRoute(
  'Forget what I say.\n\nBased on my behavior, what am I optimizing for?',
  /product truth|stress-testing the agents|fake progress|leverage|useful breakthrough|trustworthy/i
);
assert.strictEqual(behaviorOptimization.details.category, 'REFLECTION');
assert.strictEqual(behaviorOptimization.details.intent, 'RECONSTRUCT_FOUNDER_BEHAVIOR_OPTIMIZATION');
assert.match(behaviorOptimization.details.mindReconstruction.actualQuestion, /behavior.*optimize|repeated behavior/i);
assert.doesNotMatch(String(behaviorOptimization.response || ''), /CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const avoidingReflection = assertMindRoute(
  "Bro what do you think I'm avoiding right now?",
  /avoiding|uncomfortable|killer feature|user proof|hard question|truth/i
);
assert.strictEqual(avoidingReflection.details.category, 'REFLECTION');
assert.strictEqual(avoidingReflection.details.intent, 'RECONSTRUCT_FOUNDER_AVOIDANCE');
assert.match(avoidingReflection.details.mindReconstruction.actualQuestion, /avoiding|not wanting to face/i);
assert.doesNotMatch(String(avoidingReflection.response || ''), /keyboard|product implementation|previous answer|self[-\s]?evaluation|route|diagnostic|CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const notSeeingReflection = assertMindRoute(
  'What am I not seeing?',
  /not seeing|blind spot|users|care|dream|proof/i
);
assert.strictEqual(notSeeingReflection.details.category, 'REFLECTION');
assert.strictEqual(notSeeingReflection.details.intent, 'RECONSTRUCT_FOUNDER_NOT_SEEING');
assert.match(notSeeingReflection.details.mindReconstruction.actualQuestion, /not seeing|blind spot/i);
assert.doesNotMatch(String(notSeeingReflection.response || ''), /keyboard|product implementation|previous answer|self[-\s]?evaluation|route|diagnostic|CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const scaredQuestionReflection = assertMindRoute(
  "What's the question I'm scared to ask?",
  /scared|question|what if|users|care|dream|wrong/i
);
assert.strictEqual(scaredQuestionReflection.details.category, 'REFLECTION');
assert.strictEqual(scaredQuestionReflection.details.intent, 'RECONSTRUCT_SCARED_FOUNDER_QUESTION');
assert.match(scaredQuestionReflection.details.mindReconstruction.actualQuestion, /scared to ask|question/i);
assert.doesNotMatch(String(scaredQuestionReflection.response || ''), /keyboard|product implementation|previous answer|self[-\s]?evaluation|route|diagnostic|CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

assertReflectionFirewall(
  'What motivates me more than money?',
  /freedom|prove|build|control|money/i
);

assertReflectionFirewall(
  'What am I avoiding?',
  /avoiding|user proof|hard question|users do not care/i
);

assertReflectionFirewall(
  'What am I not seeing?',
  /not seeing|blind spot|users|proof/i
);

assertReflectionFirewall(
  'What should I be asking?',
  /asking|user|care|return|proof/i
);

assertReflectionFirewall(
  "What is the most important thing I haven't realized?",
  /realized|important|useful|impressive|proof/i
);

assertReflectionFirewall(
  'If users never use this product, why?',
  /users|never use|optional|habit|pain/i
);

assertReflectionFirewall(
  'If you had to bet against me, where would you bet?',
  /bet against|focus|infrastructure|user proof|useful/i
);

const dreamValidity = assertMindRoute(
  'Bro, what if my dream itself is wrong?',
  /dream might be wrong|underlying desire|keyboard is automatically the right vehicle|Explain is the current smallest test|user behavior decide/i
);
assert.strictEqual(dreamValidity.details.category, 'VISION');
assert.strictEqual(dreamValidity.details.intent, 'RECONSTRUCT_DREAM_VALIDITY_DOUBT');
assert.match(dreamValidity.details.mindReconstruction.actualQuestion, /dream itself wrong|current path.*unproven/i);
assert.doesNotMatch(String(dreamValidity.response || ''), /wrong response path|CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

const beliefShift = assertMindRoute(
  'What belief have I changed my mind about recently?',
  /changed your mind|makes Aritenis valuable|advanced agents only matter|real user leverage|repeatable product moment|Explain/i
);
assert.strictEqual(beliefShift.details.category, 'REFLECTION');
assert.strictEqual(beliefShift.details.intent, 'RECONSTRUCT_RECENT_BELIEF_SHIFT');
assert.match(beliefShift.details.mindReconstruction.actualQuestion, /belief shift|visible in my behavior/i);
assert.doesNotMatch(String(beliefShift.response || ''), /current-work|mostly maintenance|CLARIFICATION_REQUEST|NOISE|LOW INFORMATION|AMBIGUOUS INTENT|TASK_PLAN|APPROVE|Health|Momentum|Team Ready|Execution Plan/i);

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
