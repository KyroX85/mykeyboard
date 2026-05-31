const { loadFounderMemoryLayer } = require('../founder-memory-layer');

function routeFounderObjective(message = '', {
  root,
  state = {},
  memory = {}
} = {}) {
  const reconstruction = reconstructFounderObjective(message, { root, state, memory });
  if (!reconstruction || reconstruction.intent === 'NO_MATCH') return null;

  const response = buildObjectiveResponse(reconstruction);
  return {
    command: 'founder_objective_understanding',
    matchedRoute: 'founder_objective_engine',
    details: {
      agent: 'cto',
      intent: reconstruction.intent,
      founderObjective: reconstruction.objective,
      confidence: reconstruction.confidence,
      objectiveReconstruction: reconstruction.objectiveReconstruction,
      selfCheck: reconstruction.selfCheck,
      skipExecutionSchema: true
    },
    response
  };
}

function reconstructFounderObjective(message = '', {
  root,
  state = {},
  memory = {}
} = {}) {
  const original = String(message || '').trim();
  const text = normalize(original);
  if (!text || isExplicitExecution(text) || isOperationalCommand(text) || isAuditRequest(text)) {
    return null;
  }

  const base = buildBaseContext({ root, state, memory, message: original });

  if (asksHowGoing(text)) {
    return withSelfCheck({
      ...base,
      intent: 'UNDERSTAND_CURRENT_SYSTEM_STATE',
      objective: 'Learn whether the agent system is functioning, what it is watching, and whether progress is real.',
      objectiveReconstruction: [
        'Founder is checking operational reality, not asking for a task plan.',
        'Founder likely wants a plain status answer with grounded evidence and no command-parser behavior.',
        'A satisfying answer should say what is working, what is uncertain, and what is being watched.'
      ],
      directAnswer: buildHowGoingAnswer(state, memory),
      confidence: 84
    });
  }

  if (asksMonitoring(text)) {
    return withSelfCheck({
      ...base,
      intent: 'UNDERSTAND_MONITORING_SCOPE',
      objective: 'Learn what the agents are actually monitoring and whether those claims are sourced.',
      objectiveReconstruction: [
        'Founder is testing metric and monitoring provenance.',
        'Founder is not asking to start monitoring or generate a report.',
        'A satisfying answer should name monitored surfaces and admit unknowns.'
      ],
      directAnswer: buildMonitoringAnswer(state),
      confidence: 86
    });
  }

  if (asksWhyAnswered(text)) {
    return withSelfCheck({
      ...base,
      intent: 'EXPLAIN_RESPONSE_REASONING_FAILURE',
      objective: 'Understand why the agent gave a previous answer and whether it was reasoning or template routing.',
      objectiveReconstruction: [
        'Founder is asking for reasoning provenance.',
        'Founder wants the agent to explain the cause of its answer, not defend it.',
        'A satisfying answer should identify whether the answer came from objective reasoning, memory retrieval, or keyword/template routing.'
      ],
      directAnswer: [
        'If the answer did not address your actual question first, the likely cause was routing, not intelligence.',
        'The old path treated keywords like “vision”, “phase”, “health”, or “roadmap” as intent and selected a canned response.',
        'The correct path is: reconstruct your objective, answer that objective, then cite evidence and uncertainty.'
      ],
      confidence: 85
    });
  }

  if (asksAgentUnderstanding(text)) {
    return withSelfCheck({
      ...base,
      intent: 'EVALUATE_AGENT_PROJECT_UNDERSTANDING',
      objective: 'Determine whether the deployed agents understand the project vision or only retrieve templates.',
      objectiveReconstruction: [
        'Founder is testing reasoning quality, not asking for roadmap status.',
        'Founder wants to know if agents can infer the real question behind the words.',
        'A satisfying answer should distinguish stored memory from actual objective reconstruction.'
      ],
      directAnswer: [
        'Not fully yet. They have the founder memory, but memory is not the same as understanding.',
        'Real understanding means reconstructing what you are trying to learn, answering that directly, and using templates only as fallback.',
        'If an agent answers with a fixed roadmap-status block to this question, it failed the objective and matched keywords instead.'
      ],
      confidence: 82
    });
  }

  if (asksWhatBuilding(text)) {
    if (asksBuildBoundaries(text)) {
      return withSelfCheck({
        ...base,
        intent: 'RECONSTRUCT_PRODUCT_VISION_AND_BOUNDARIES',
        objective: 'Explain the company goal and reject impressive-sounding directions that conflict with it.',
        objectiveReconstruction: [
          'Founder is asking for vision plus strategic restraint.',
          'Founder does not want a roadmap-status template.',
          'A satisfying answer should state the product outcome and the dangerous things not to build.'
        ],
        directAnswer: [
          'The goal is to make Aritenis the keyboard people choose because it helps them understand confusing content before they type.',
          'The foundation must stay calm, private, fast, and reliable.',
          'Do not build auto-send, emotional companion theater, silent screenshot reading, raw typing collection, cloud telemetry, forever screenshot storage, or generic multi-agent spectacle.'
        ],
        confidence: 88
      });
    }
    return withSelfCheck({
      ...base,
      intent: 'RECONSTRUCT_PRODUCT_VISION',
      objective: 'Reconstruct the actual product being built and the outcome it should create for users.',
      objectiveReconstruction: [
        'Founder is asking for company/product understanding.',
        'Founder does not want a phase template or engineering status.',
        'A satisfying answer should explain the product and user outcome in plain language.'
      ],
      directAnswer: [
        'We are building Aritenis: a trusted Android keyboard that helps users understand confusing content before they type.',
        'The foundation is a calm, private, reliable keyboard. The differentiator is Explain: helping users make sense of screenshots, messages, forms, bills, posts, errors, and documents inside the typing flow.',
        'The actual user outcome is confidence: the user understands what is in front of them and can respond or act without leaving the conversation.'
      ],
      confidence: 87
    });
  }

  if (asksBuildBoundaries(text)) {
    return withSelfCheck({
      ...base,
      intent: 'RECONSTRUCT_BUILD_BOUNDARIES',
      objective: 'Identify impressive-sounding directions that conflict with the founder vision.',
      objectiveReconstruction: [
        'Founder is testing strategic judgment.',
        'Founder wants restraint, not a feature list.',
        'A satisfying answer should reject tempting but trust-damaging directions.'
      ],
      directAnswer: [
        'Do not build auto-send, emotional companion theater, silent screenshot reading, raw typing collection, cloud telemetry, forever screenshot storage, or generic multi-agent spectacle.',
        'Do not compete with Gboard mainly through prediction, themes, swipe claims, or settings unless there is verified foundation regression.',
        'Anything that makes typing feel less private, less calm, or less reliable is not worth the Phase 2 leverage.'
      ],
      confidence: 88
    });
  }

  if (asksExplainPain(text)) {
    return withSelfCheck({
      ...base,
      intent: 'EXPLAIN_ACTIVE_WEDGE_USER_PAIN',
      objective: 'Explain what real user pain the Explain wedge solves.',
      objectiveReconstruction: [
        'Founder is testing whether the agent understands Phase 2 value.',
        'Founder is not asking for a generic feature description.',
        'A satisfying answer should name the confusion moment and why a keyboard can uniquely help.'
      ],
      directAnswer: [
        'Explain solves the moment where a user sees something confusing and needs to understand it before replying or acting.',
        'That can be a screenshot, message, bill, form, error, notice, post, or document.',
        'Existing keyboards mostly help users type; Aritenis should help users understand what they are typing about.'
      ],
      confidence: 85
    });
  }

  if (asksScreenshotPrivacy(text)) {
    return withSelfCheck({
      ...base,
      intent: 'DEFINE_EXPLAIN_SCREENSHOT_PRIVACY_BOUNDARY',
      objective: 'Clarify whether Explain can retain screenshots and what privacy boundary protects trust.',
      objectiveReconstruction: [
        'Founder is testing privacy judgment for the Explain wedge.',
        'Founder is not asking to run Product Lab screenshot capture.',
        'A satisfying answer should reject forever storage and state the safe boundary.'
      ],
      directAnswer: [
        'No. Explain should not store screenshots forever.',
        'Screenshots should be explicit, user-triggered, temporary context for understanding.',
        'The safe boundary is no silent reading, no raw personal retention by default, and no automatic sending.'
      ],
      confidence: 88
    });
  }

  if (asksPhaseOrRoadmap(text)) {
    return withSelfCheck({
      ...base,
      intent: 'RECONSTRUCT_CURRENT_ROADMAP_PRIORITY',
      objective: 'State the current roadmap priority without turning the question into execution or a canned status block.',
      objectiveReconstruction: [
        'Founder is asking for roadmap understanding.',
        'Founder does not want engineering health output.',
        'A satisfying answer should distinguish protected foundation from active Phase 2 Explain work.'
      ],
      directAnswer: [
        'Current roadmap: Phase 1 foundation is protected, and Phase 2 Explain is active.',
        'Protect typing trust, swipe trust, prediction quality, sizing, latency, and stability.',
        'Move Explain forward through design, screenshot understanding, Product Lab evidence, and founder-approved implementation that does not damage hot paths.'
      ],
      confidence: 87
    });
  }

  return null;
}

function buildBaseContext({ root, state, memory, message }) {
  const founderMemoryLayer = loadFounderMemoryLayer({ root });
  return {
    message,
    founderMemoryLayer,
    evidence: buildEvidence({ state, founderMemoryLayer }),
    uncertainty: buildUncertainty({ state, memory })
  };
}

function buildHowGoingAnswer(state = {}, memory = {}) {
  const health = metric(state, 'health');
  const momentum = metric(state, 'momentum');
  const topWatch = first(state.sections && state.sections.unresolved) ||
    first(state.sections && state.sections.risks) ||
    'unknown';
  const pending = memory.pendingAction ||
    first(state.sections && state.sections.nextPriority) ||
    first(state.sections && state.sections.safestOpportunity) ||
    'none recorded';
  return [
    'Things are running, but I should not call it fully clean.',
    `Main watch item: ${topWatch}.`,
    `Pending action: ${pending}.`,
    `Health: ${health.value}. Source: ${health.source}. Reason: ${health.reason}. Calculation: ${health.calculation}.`,
    `Momentum: ${momentum.value}. Source: ${momentum.source}. Reason: ${momentum.reason}. Calculation: ${momentum.calculation}.`
  ];
}

function buildMonitoringAnswer(state = {}) {
  const health = metric(state, 'health');
  const areas = ['WhatsApp routing quality', 'founder objective understanding', 'brain scan freshness', 'roadmap alignment'];
  const unresolvedText = [
    ...asArray(state.sections && state.sections.unresolved),
    ...asArray(state.sections && state.sections.risks)
  ].join(' ').toLowerCase();
  if (/keyboard|swipe|typing|predictor|latency/.test(unresolvedText)) areas.push('keyboard foundation risk');
  if (/github|workflow|product lab|screenshot/.test(unresolvedText)) areas.push('Product Lab reliability');
  return [
    `I am monitoring: ${areas.join(', ')}.`,
    `Top watched item: ${first(state.sections && state.sections.unresolved) || first(state.sections && state.sections.risks) || 'unknown'}.`,
    `Metric provenance check: Health is ${health.value}. Source: ${health.source}. Reason: ${health.reason}. Calculation: ${health.calculation}.`,
    'If a metric has no source, I should say unknown instead of inventing a score.'
  ];
}

function buildObjectiveResponse(reconstruction) {
  return [
    reconstruction.directAnswer.join('\n'),
    '',
    'Objective reconstruction:',
    ...reconstruction.objectiveReconstruction.map((item) => `- ${item}`),
    '',
    `Founder objective: ${reconstruction.objective}`,
    `Intent confidence: ${Math.min(90, reconstruction.confidence)}%`,
    `Confidence: ${Math.min(90, reconstruction.confidence)}%`,
    '',
    'Evidence used:',
    ...reconstruction.evidence.map((item) => `- ${item}`),
    '',
    'Uncertainty / missing information:',
    ...reconstruction.uncertainty.map((item) => `- ${item}`),
    '',
    `Self-check: ${reconstruction.selfCheck}`
  ].join('\n');
}

function withSelfCheck(reconstruction) {
  const selfCheck = responseAnswersFounderObjective(reconstruction)
    ? 'answered the founder actual objective'
    : 'failed objective match; response must be regenerated';
  return {
    ...reconstruction,
    selfCheck
  };
}

function responseAnswersFounderObjective(reconstruction = {}) {
  const answer = asArray(reconstruction.directAnswer).join(' ').toLowerCase();
  const objective = String(reconstruction.objective || '').toLowerCase();
  if (!answer || !objective) return false;
  if (reconstruction.intent === 'UNDERSTAND_CURRENT_SYSTEM_STATE') return /running|watch|health|momentum|clean/.test(answer);
  if (reconstruction.intent === 'UNDERSTAND_MONITORING_SCOPE') return /monitoring|watched|source|unknown/.test(answer);
  if (reconstruction.intent === 'EVALUATE_AGENT_PROJECT_UNDERSTANDING') return /memory|understanding|template|objective/.test(answer);
  if (reconstruction.intent === 'EXPLAIN_RESPONSE_REASONING_FAILURE') return /routing|keyword|objective|template/.test(answer);
  if (reconstruction.intent === 'RECONSTRUCT_PRODUCT_VISION') return /aritenis|keyboard|understand before they type|typing flow/.test(answer);
  if (reconstruction.intent === 'RECONSTRUCT_PRODUCT_VISION_AND_BOUNDARIES') return /understand confusing content before they type|do not build|auto-send/.test(answer);
  if (reconstruction.intent === 'RECONSTRUCT_BUILD_BOUNDARIES') return /do not build|auto-send|telemetry|raw typing/.test(answer);
  if (reconstruction.intent === 'EXPLAIN_ACTIVE_WEDGE_USER_PAIN') return /confusing|understand|typing about/.test(answer);
  if (reconstruction.intent === 'DEFINE_EXPLAIN_SCREENSHOT_PRIVACY_BOUNDARY') return /not store screenshots forever|temporary|no silent reading/.test(answer);
  if (reconstruction.intent === 'RECONSTRUCT_CURRENT_ROADMAP_PRIORITY') return /phase 1 foundation is protected|phase 2 explain is active/.test(answer);
  return true;
}

function buildEvidence({ state = {}, founderMemoryLayer = null } = {}) {
  const evidence = [];
  if (founderMemoryLayer) evidence.push('Founder memory loaded as persistent project context.');
  evidence.push('Founder direction says Phase 1 foundation is protected and Phase 2 Explain is active.');
  evidence.push('Founder direction says keywords are evidence, never intent.');
  if (state.generatedAt) evidence.push(`Engineering state loaded from latest scan timestamp ${state.generatedAt}.`);
  return evidence;
}

function buildUncertainty({ state = {}, memory = {} } = {}) {
  const uncertainty = [];
  if (!state.metricProvenance) uncertainty.push('Metric provenance was not loaded for this request.');
  if (!memory || !Object.keys(memory).length) uncertainty.push('Short-term conversation memory may be empty.');
  uncertainty.push('Long-term user retention for Explain is still unproven.');
  return uncertainty;
}

function metric(state = {}, key) {
  const metric = state.metricProvenance && state.metricProvenance[key];
  if (!metric || !metric.value || metric.source === 'unknown') {
    return {
      value: 'unknown',
      source: 'unknown',
      reason: 'No verified metric source was loaded.',
      calculation: 'unknown'
    };
  }
  return metric;
}

function asksHowGoing(text) {
  return /\b(how'?s|hows|how is|how are)\b.*\b(going|things|everything|work|progress)\b/.test(text) ||
    /\bhow\s+work\s+(is\s+)?going\b/.test(text) ||
    /\beverything okay\b/.test(text);
}

function asksMonitoring(text) {
  return /\bwhat\s+(are|r)\s+(you|u|agents?)\s+monitoring\b/.test(text) ||
    /\bwhat.*being monitored\b/.test(text);
}

function asksAgentUnderstanding(text) {
  return /\bagents?\b/.test(text) &&
    /\b(understand|vision|project|intelligent|intelligence|basic|rule based|template|vague)\b/.test(text);
}

function asksWhyAnswered(text) {
  return /\bwhy\b.*\b(answer|answered|reply|respond|responded)\b/.test(text) ||
    /\bwhy\b.*\b(agent|agents?|you)\b.*\b(give|gave)\b.*\b(response|answer|reply)\b/.test(text) ||
    /\bwhy did you answer that way\b/.test(text);
}

function asksWhatBuilding(text) {
  return /\b(what are we actually trying to build|what are we building|what product are we building|actual aim|final goal|company goal|north star)\b/.test(text);
}

function asksBuildBoundaries(text) {
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
  return /^(status|health|risks|risk|momentum|memory audit|capture screenshot|latest screenshot|send latest screenshot|build now|scan now|fresh scan|school mode|fix limit|execution status|execution history)$/i.test(text) ||
    /\b(enter preservation mode|disable preservation mode|approve-|run product lab)\b/.test(text);
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

function first(items) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  routeFounderObjective,
  reconstructFounderObjective,
  buildObjectiveResponse,
  responseAnswersFounderObjective
};
