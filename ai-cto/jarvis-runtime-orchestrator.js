const { answerFounderBrainQuestion } = require('./founder-brain-api');
const { buildAgentCouncil, summarizeCouncil } = require('./orchestration/agent-council-engine');
const { buildJarvisSpeech } = require('./jarvis-speech-layer');

const WAKE_WORD_PATTERN = /^(?:hey\s+jarvis|jarvis|aritenis)\b[:,\s-]*/i;

async function runJarvisRuntime({
  input = '',
  state = null,
  memory = null,
  root,
  publicBaseUrl = '',
  founderBrain = answerFounderBrainQuestion,
  agentCouncil = buildAgentCouncil,
  executionLayer = buildExecutionLayerDecision
} = {}) {
  const received = String(input || '').trim();
  const normalized = normalizeJarvisInput(received);
  if (!normalized.question) {
    return buildEmptyRuntimeResult(received);
  }

  const brain = await founderBrain({
    question: normalized.question,
    state,
    memory,
    root,
    publicBaseUrl
  });
  const council = agentCouncil(buildCouncilProposal(normalized.question, brain));
  const councilSummary = summarizeCouncil(council);
  const decision = buildFinalDecision({ brain, council, councilSummary });
  const execution = executionLayer({ decision, brain, council, question: normalized.question });
  const speech = buildJarvisSpeech({
    rawReasoning: brain.rawReasoning,
    summary: brain.summary,
    voiceSummary: brain.voiceSummary,
    fallback: normalized.question
  });

  return {
    ok: true,
    runtime: 'JARVIS_RUNTIME_ORCHESTRATOR_V1',
    entryPoint: 'jarvis_runtime',
    input: {
      received,
      wakeWordDetected: normalized.wakeWordDetected,
      question: normalized.question
    },
    flow: [
      'wake_word',
      'jarvis_runtime',
      'founder_brain',
      'agent_council',
      'final_decision',
      'execution_layer',
      'response'
    ],
    founderBrain: brain,
    agentCouncil: {
      decision: council.decision,
      consensus: councilSummary.consensus,
      dissent: councilSummary.dissent,
      approvalNeeded: councilSummary.approvalNeeded
    },
    finalDecision: decision,
    executionLayer: execution,
    speech,
    response: speech.voiceSummary,
    spokenResponse: speech.spokenResponse,
    voiceSummary: speech.voiceSummary
  };
}

function normalizeJarvisInput(input = '') {
  const received = String(input || '').trim();
  const wakeWordDetected = WAKE_WORD_PATTERN.test(received);
  const question = received.replace(WAKE_WORD_PATTERN, '').trim();
  return {
    received,
    wakeWordDetected,
    question: question || received
  };
}

function buildCouncilProposal(question = '', brain = {}) {
  return [
    String(question || '').trim(),
    brain && brain.summary ? `Founder Brain summary: ${brain.summary}` : ''
  ].filter(Boolean).join('\n');
}

function buildFinalDecision({ brain = {}, council = {}, councilSummary = {} } = {}) {
  const type = String(brain.type || 'unclear');
  const requiresExecution = type === 'execution';
  const councilDecision = String(council.decision || 'REVIEW_BEFORE_EXECUTION');
  const blocked = /BLOCK|REJECT|REQUIRE_FOUNDATION_EVIDENCE/i.test(councilDecision);
  const approvalRequired = requiresExecution || /REVIEW|REQUIRE|APPROVE/i.test(councilDecision);
  return {
    type,
    decision: blocked
      ? 'BLOCK_OR_REVIEW'
      : requiresExecution
        ? 'PREPARE_ACTION_WITH_APPROVAL'
        : 'ANSWER_ONLY',
    approvalRequired,
    agentsMaySpeakDirectly: false,
    jarvisSpeaks: 'voiceSummary',
    reason: blocked
      ? councilSummary.dissent || 'Council found a risk.'
      : requiresExecution
        ? 'Execution request must pass through the execution layer and founder approval.'
        : 'Founder Brain answer is sufficient; no action execution required.'
  };
}

function buildExecutionLayerDecision({ decision = {}, brain = {}, council = {} } = {}) {
  if (decision.decision === 'ANSWER_ONLY') {
    return {
      mode: 'NO_ACTION',
      action: null,
      confirmRequired: false,
      reason: 'No execution requested.'
    };
  }
  return {
    mode: 'ACTION_SURFACE',
    action: {
      type: brain.type || 'execution',
      councilDecision: council.decision || 'REVIEW_BEFORE_EXECUTION'
    },
    confirmRequired: true,
    reason: 'Execution layer prepares action only; it does not auto-send or auto-mutate.'
  };
}

function buildEmptyRuntimeResult(received = '') {
  return {
    ok: false,
    runtime: 'JARVIS_RUNTIME_ORCHESTRATOR_V1',
    entryPoint: 'jarvis_runtime',
    input: {
      received,
      wakeWordDetected: false,
      question: ''
    },
    flow: ['wake_word', 'jarvis_runtime'],
    founderBrain: null,
    agentCouncil: null,
    finalDecision: {
      type: 'unclear',
      decision: 'CLARIFY',
      approvalRequired: false,
      agentsMaySpeakDirectly: false,
      jarvisSpeaks: 'voiceSummary',
      reason: 'No usable Jarvis input was provided.'
    },
    executionLayer: {
      mode: 'NO_ACTION',
      action: null,
      confirmRequired: false,
      reason: 'No execution requested.'
    },
    response: 'I need a question.',
    spokenResponse: 'I need a question.',
    voiceSummary: 'I need a question.'
  };
}

module.exports = {
  runJarvisRuntime,
  normalizeJarvisInput,
  buildCouncilProposal,
  buildFinalDecision,
  buildExecutionLayerDecision
};
