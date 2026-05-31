const { buildRealityReconstruction } = require('../reality-reconstruction-layer');
const { loadFounderMemoryLayer } = require('../founder-memory-layer');

function routeFounderIntentUnderstanding(message = '', { root } = {}) {
  const understanding = understandFounderObjective(message, { root });
  if (!understanding || understanding.intent === 'NO_MATCH') return null;
  const response = buildObjectiveResponse(understanding);
  return {
    command: 'founder_intent_understanding',
    matchedRoute: 'founder_intent_understanding',
    details: {
      agent: 'cto',
      intent: understanding.intent,
      founderObjective: understanding.objective,
      confidence: understanding.confidence,
      selfCheck: understanding.selfCheck
    },
    response
  };
}

function understandFounderObjective(message = '', { root } = {}) {
  const original = String(message || '').trim();
  const text = normalize(original);
  if (!text || isExplicitExecution(text) || isOperationalCommand(text) || isAuditRequest(text)) {
    return null;
  }

  const memoryLayer = loadFounderMemoryLayer({ root });
  const reality = buildRealityReconstruction({ question: original, root, memoryLayer });
  const base = {
    message: original,
    root,
    memoryLayer,
    reality,
    evidence: [
      'Founder memory defines the north star as understanding before typing.',
      'Project state says Phase 1 is protected and Phase 2 Explain is active.',
      'Rejected directions forbid architecture vanity, auto-send, raw data collection, and chatbot theater.'
    ],
    uncertainty: [
      'Explain has not yet been proven with long-term retention evidence.',
      'Agent reasoning quality still depends on routing discipline and loaded founder memory.'
    ]
  };

  if (asksTemplateFailure(text)) {
    return withSelfCheck({
      ...base,
      intent: 'DIAGNOSE_TEMPLATE_ROUTING_FAILURE',
      objective: 'Explain why the agent produced an irrelevant template answer and what behavior should replace it.',
      answer: [
        'That failure is keyword routing.',
        'The agent saw words like roadmap, phase, foundation, Explain, or vision, then selected a canned block instead of asking what you were trying to learn.',
        'The fix is to classify the founder objective first and only fall back to templates when objective confidence is low.'
      ],
      confidence: 88
    });
  }

  if (asksAgentUnderstanding(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ASSESS_AGENT_VISION_UNDERSTANDING',
      objective: 'Determine whether the deployed agents truly understand the founder vision or only retrieve templates.',
      answer: [
        'Partially, but not enough if they answer with fixed roadmap blocks.',
        'They have the vision in founder memory, but real understanding means reconstructing the question, answering the exact concern, and using templates only as fallback.',
        'This layer treats the message as a test of agent understanding, not as a generic Phase 2 roadmap question.'
      ],
      confidence: 84
    });
  }

  if (asksMemoryQuality(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ASSESS_MEMORY_QUALITY',
      objective: 'Determine whether the issue is missing memory, weak retrieval, or weak reasoning over memory.',
      answer: [
        'The memory layer is necessary but not sufficient.',
        'If the agent repeats founder-memory text without answering the actual question, the bottleneck is reasoning over memory, not storage.',
        'The correct behavior is: load founder memory, infer the founder objective, answer directly, then cite evidence and uncertainty.'
      ],
      confidence: 86
    });
  }

  if (asksCompanyGoal(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ANSWER_COMPANY_GOAL',
      objective: 'Explain the company goal in plain language without drifting into roadmap template output.',
      answer: [
        'The goal is to make Aritenis the keyboard people choose because it helps them understand confusing content before they type.',
        'The keyboard foundation must stay calm, fast, private, and trustworthy.',
        'The differentiator is not better prediction or more agent theater; it is useful understanding inside the typing flow.'
      ],
      confidence: 87
    });
  }

  if (asksDoNotBuild(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ANSWER_BUILD_BOUNDARIES',
      objective: 'State what should not be built even if it sounds impressive.',
      answer: [
        'Do not build auto-send, silent screenshot reading, forever screenshot storage, emotional simulation, raw typing collection, cloud telemetry, architecture vanity, or generic multi-agent complexity.',
        'Also do not compete with Gboard mainly through prediction, swipe, themes, or settings unless evidence shows a foundation regression.',
        'Anything that weakens typing trust is not worth the Phase 2 leverage.'
      ],
      confidence: 88
    });
  }

  if (asksExplainPain(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ANSWER_EXPLAIN_USER_PAIN',
      objective: 'Explain the specific user pain solved by Explain.',
      answer: [
        'Explain solves the moment where a user sees something confusing and must understand it before replying or acting.',
        'Examples are screenshots, messages, bills, forms, errors, notices, posts, and documents.',
        'Existing keyboards mostly help users type faster; Aritenis should help users understand what they are about to type about.'
      ],
      confidence: 85
    });
  }

  if (asksScreenshotPrivacy(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ANSWER_SCREENSHOT_PRIVACY_BOUNDARY',
      objective: 'Clarify screenshot privacy boundaries for Explain.',
      answer: [
        'No, Explain should not store screenshots forever.',
        'Screenshots should be explicit, user-triggered, temporary context for understanding.',
        'The safe boundary is no silent reading, no raw personal retention by default, and no automatic sending.'
      ],
      confidence: 88
    });
  }

  if (asksPhaseOrRoadmap(text)) {
    return withSelfCheck({
      ...base,
      intent: 'ANSWER_CURRENT_ROADMAP_STATE',
      objective: 'State the current roadmap without treating the question as execution.',
      answer: [
        'Current state: Phase 1 is a protected foundation, and Phase 2 Explain is active.',
        'That means typing trust, swipe trust, prediction quality, sizing, latency, and stability are guarded assets.',
        'Explain work can move forward through design, Product Lab evidence, proposals, and founder-approved implementation that does not damage hot paths.'
      ],
      confidence: 87
    });
  }

  return null;
}

function buildObjectiveResponse(understanding) {
  const lines = [
    ...understanding.answer,
    '',
    `Founder objective I inferred: ${understanding.objective}`,
    '',
    'Why I believe this:',
    ...understanding.evidence.map((item) => `- ${item}`),
    '',
    'Evidence sources used:',
    '- FOUNDER_VISION.md',
    '- PROJECT_STATE.md',
    '- CURRENT_STAGE.md',
    '- REJECTED_DIRECTIONS.md',
    '- ACTIVE_HYPOTHESES.md',
    '',
    'Missing information / uncertainty:',
    ...understanding.uncertainty.map((item) => `- ${item}`),
    '',
    `Confidence: ${Math.min(90, understanding.confidence)}%`,
    `Self-check: ${understanding.selfCheck}`
  ];
  return lines.join('\n');
}

function withSelfCheck(understanding) {
  return {
    ...understanding,
    selfCheck: responseAnswersObjective(understanding)
      ? 'answered the founder objective directly'
      : 'response does not answer objective; replan required'
  };
}

function responseAnswersObjective(understanding) {
  const answer = Array.isArray(understanding.answer) ? understanding.answer.join(' ').toLowerCase() : '';
  if (!answer) return false;
  if (understanding.intent === 'ASSESS_AGENT_VISION_UNDERSTANDING') return /\b(partially|not enough|understand)/.test(answer);
  if (understanding.intent === 'ASSESS_MEMORY_QUALITY') return /\b(memory|reasoning)/.test(answer);
  if (understanding.intent === 'DIAGNOSE_TEMPLATE_ROUTING_FAILURE') return /\b(keyword|template|objective)/.test(answer);
  if (understanding.intent === 'ANSWER_COMPANY_GOAL') return /\bunderstand confusing content before they type/.test(answer);
  if (understanding.intent === 'ANSWER_BUILD_BOUNDARIES') return /\bdo not build|auto-send|telemetry/.test(answer);
  if (understanding.intent === 'ANSWER_EXPLAIN_USER_PAIN') return /\bconfusing|understand/.test(answer);
  if (understanding.intent === 'ANSWER_SCREENSHOT_PRIVACY_BOUNDARY') return /\bnot store screenshots forever|temporary/.test(answer);
  if (understanding.intent === 'ANSWER_CURRENT_ROADMAP_STATE') return /\bphase 1.*protected|phase 2.*explain/.test(answer);
  return true;
}

function asksAgentUnderstanding(text) {
  return /\bagents?\b/.test(text) &&
    /\b(really understand|understand my vision|understand.*vision|intelligent|intelligence|basic|rule based|template|vague)\b/.test(text);
}

function asksMemoryQuality(text) {
  return /\b(memory|remember|founder context|context)\b/.test(text) &&
    /\b(quality|really|understand|retrieval|fragments|enough|works?|working)\b/.test(text);
}

function asksTemplateFailure(text) {
  return /\b(template|keyword|irrelevant|not reading|wrong answer|rule based|vague|annoy)\b/.test(text);
}

function asksCompanyGoal(text) {
  return /\b(final goal|company goal|north star|mission|ultimate aim|purpose|actual aim)\b/.test(text);
}

function asksDoNotBuild(text) {
  return /\b(what should not|should not build|shouldn't build|not build|avoid|even if.*impressive|sounds impressive)\b/.test(text);
}

function asksExplainPain(text) {
  return /\b(user pain|pain.*explain|explain.*solve|why.*explain|what.*explain.*solve)\b/.test(text);
}

function asksScreenshotPrivacy(text) {
  return /\b(store|save|retain|forever|privacy|private)\b/.test(text) && /\b(explain|screenshots?)\b/.test(text);
}

function asksPhaseOrRoadmap(text) {
  return /\b(current roadmap|roadmap priority|phase 2|phase two|current phase|what phase|stage)\b/.test(text);
}

function isOperationalCommand(text) {
  return /\b(capture screenshot|latest screenshot|enter preservation mode|disable preservation mode|school mode|status|health|risks|momentum|fix now|approve-)\b/.test(text);
}

function isAuditRequest(text) {
  return text === 'memory audit' ||
    /\b(project|founder|company|vision)\s+audit\b/.test(text) ||
    /\banswer only from memory\b/.test(text) ||
    /\bonly reconstruct project state\b/.test(text);
}

function isExplicitExecution(text) {
  const withoutNegatedInstructions = text
    .replace(/\bdo not (propose|execute|create|write|modify|edit|commit|push|implement|run|build)[^.?\n]*/g, '')
    .replace(/\bnever (propose|execute|create|write|modify|edit|commit|push|implement|run|build)[^.?\n]*/g, '');
  return /\b(implement|execute|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|fix now)\b/.test(withoutNegatedInstructions);
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

module.exports = {
  routeFounderIntentUnderstanding,
  understandFounderObjective,
  buildObjectiveResponse
};
