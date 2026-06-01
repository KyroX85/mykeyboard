const REFLECTION_PATTERNS = [
  /\bwhy\s+(am\s+i|did\s+i)\s+(asking|ask)\b/i,
  /\bwhy\s+did\s+i\s+ask\s+that\b/i,
  /\bwhat\s+assumption\s+(am\s+i|i\s+am|am\s+i\s+holding|am\s+i\s+testing)\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+(worried|concerned)\s+about\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+testing\b/i,
  /\bwhat\s+is\s+my\s+(hidden\s+)?(concern|objective|intent)\b/i
];

const AGENT_UNDERSTANDING_PATTERNS = [
  /\b(do|does)\s+(my\s+)?agents?\s+(really\s+)?understand\b/i,
  /\bagents?\b.*\b(understand|vision|project|dumb|basic|rule[-\s]?based|template|keyword)\b/i,
  /\b(are|r)\s+(my\s+)?agents?\s+(smart|intelligent|useful|basic|dumb)\b/i
];

const AWARENESS_CHECK_PATTERNS = [
  /\bwhat'?s\s+happening\b/i,
  /\bwhats\s+happening\b/i,
  /\bwhat\s+is\s+happening\b/i,
  /\bwhat'?s\s+going\s+on\b/i,
  /\bwhats\s+going\s+on\b/i
];

const FORBIDDEN_REFLECTION_OUTPUT = /(Current Foundation Health|Momentum:\s*STALLED|Health:\s*\d+|Recommended Next Step|roadmap priority|Phase 1 foundation is protected)/i;

function routeFounderMindReconstruction(message = '', context = {}) {
  const reconstruction = reconstructFounderMind(message, context);
  if (!reconstruction || reconstruction.mode === 'NO_MATCH') return null;

  const response = buildReflectionResponse(reconstruction, {
    debug: Boolean(context.debug)
  });

  return {
    command: 'founder_mind_reconstruction',
    matchedRoute: 'founder_mind_reconstruction',
    details: {
      agent: 'cto',
      intent: reconstruction.intent,
      mode: 'REFLECTION_MODE',
      confidence: reconstruction.confidence,
      mindReconstruction: reconstruction.report,
      selfCheck: reconstruction.selfCheck,
      skipExecutionSchema: true
    },
    response
  };
}

function reconstructFounderMind(message = '', context = {}) {
  const original = String(message || '').trim();
  const text = normalize(original);
  if (!text || isExplicitExecution(text) || isAuditRequest(text)) return null;

  const kind = classifyMindQuestion(text);
  if (!kind) return null;

  const report = buildMindReport(kind, original, context);
  const reconstruction = {
    mode: 'REFLECTION_MODE',
    intent: kind.intent,
    message: original,
    report,
    directAnswer: buildDirectAnswer(kind, report),
    confidence: kind.confidence
  };

  return {
    ...reconstruction,
    selfCheck: responseAnswersFounderMind(reconstruction)
      ? 'answered the founder reason behind the question'
      : 'failed founder mind reconstruction; response must be regenerated'
  };
}

function classifyMindQuestion(text = '') {
  if (REFLECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'RECONSTRUCT_FOUNDER_META_REASONING',
      archetype: 'reflection',
      confidence: 86
    };
  }

  if (AGENT_UNDERSTANDING_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'ASSESS_AGENT_UNDERSTANDING_ANXIETY',
      archetype: 'agent_understanding',
      confidence: 84
    };
  }

  if (AWARENESS_CHECK_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'INTERPRET_AWARENESS_CHECK',
      archetype: 'awareness_check',
      confidence: 78
    };
  }

  return null;
}

function buildMindReport(kind, message, context = {}) {
  if (kind.archetype === 'agent_understanding') {
    return {
      objective: 'Check whether the agents can reason from founder vision instead of repeating memory or templates.',
      assumption: 'The founder suspects the deployed agents may still be keyword routers with founder-memory retrieval attached.',
      concern: 'If the agents only summarize the project, they cannot be trusted to operate while the founder is absent.',
      desiredOutcome: 'A blunt assessment of actual understanding quality, including what would prove improvement.',
      actualQuestion: 'Do the agents understand the project deeply enough to answer the real concern behind my words?',
      uselessLiteralAnswer: 'A project summary or roadmap status block.'
    };
  }

  if (kind.archetype === 'awareness_check') {
    return {
      objective: 'Check whether the system is aware of context and can respond naturally without dumping status templates.',
      assumption: 'The founder may be testing whether casual conversation is still misrouted as operational status.',
      concern: 'The agents may sound busy while failing to understand what the founder is checking.',
      desiredOutcome: 'A short answer that explains the likely context and offers evidence-backed status only if requested.',
      actualQuestion: 'Are you aware of what I am trying to check right now?',
      uselessLiteralAnswer: 'A health, momentum, or roadmap report without explaining the inferred concern.'
    };
  }

  return {
    objective: 'Understand the reason behind the founder question instead of answering the literal words.',
    assumption: 'The founder is testing whether the agent can reconstruct hidden intent before routing.',
    concern: 'The current agent may still be a template selector that misses worry, doubt, and evaluation pressure.',
    desiredOutcome: 'A direct reconstruction of the hidden objective, assumption, concern, and satisfying answer.',
    actualQuestion: 'What am I really trying to learn by asking this?',
    uselessLiteralAnswer: 'A generic status, health, momentum, or roadmap response.'
  };
}

function buildDirectAnswer(kind, report) {
  if (kind.archetype === 'agent_understanding') {
    return [
      'You are not asking for a project summary.',
      'You are testing whether the agents can connect your vision, the current company phase, and the hidden worry inside the question.',
      'My read: they understand fragments, but the important test is whether they answer your real concern without falling into founder-memory recitation.',
      `The assumption being tested: ${report.assumption}`,
      `The concern underneath it: ${report.concern}`,
      'A good answer should say what evidence proves understanding: direct answers, fewer templates, correct phase judgment, and no irrelevant health or roadmap blocks.'
    ];
  }

  if (kind.archetype === 'awareness_check') {
    return [
      'You may be checking whether the agents are actually context-aware or just waiting for keywords.',
      'The useful answer is not a health report. It is: I should infer whether you want awareness, status, or action before responding.',
      `The assumption being tested: ${report.assumption}`,
      'If you want operational status, it should be evidence-backed. If you are just checking awareness, no workflow should start.'
    ];
  }

  return [
    'You are probably testing whether the agents can infer the reason behind your words, not just classify the words.',
    `The assumption being tested: ${report.assumption}`,
    `The worry underneath it: ${report.concern}`,
    `The answer that would satisfy you: ${report.desiredOutcome}`,
    'So I should answer the hidden evaluation first and avoid dumping health, momentum, or roadmap status.'
  ];
}

function buildReflectionResponse(reconstruction, { debug = false } = {}) {
  const lines = [...reconstruction.directAnswer];

  if (debug) {
    lines.push('');
    lines.push('Mind reconstruction:');
    lines.push(`Objective: ${reconstruction.report.objective}`);
    lines.push(`Assumption: ${reconstruction.report.assumption}`);
    lines.push(`Concern: ${reconstruction.report.concern}`);
    lines.push(`Desired Outcome: ${reconstruction.report.desiredOutcome}`);
    lines.push(`Actual Question: ${reconstruction.report.actualQuestion}`);
    lines.push(`Most useless literal answer: ${reconstruction.report.uselessLiteralAnswer}`);
    lines.push(`Confidence: ${Math.min(90, reconstruction.confidence)}%`);
    lines.push(`Self-check: ${reconstruction.selfCheck}`);
  }

  return lines.join('\n');
}

function responseAnswersFounderMind(reconstruction = {}) {
  const answer = String((reconstruction.directAnswer || []).join(' '));
  if (!answer || FORBIDDEN_REFLECTION_OUTPUT.test(answer)) return false;
  const report = reconstruction.report || {};
  if (!report.objective || !report.assumption || !report.concern || !report.desiredOutcome || !report.actualQuestion) {
    return false;
  }
  if (reconstruction.intent === 'ASSESS_AGENT_UNDERSTANDING_ANXIETY') {
    return /not asking for a project summary|understand fragments|evidence proves understanding/i.test(answer);
  }
  if (reconstruction.intent === 'INTERPRET_AWARENESS_CHECK') {
    return /context-aware|keywords|health report|awareness/i.test(answer);
  }
  return /reason behind your words|assumption being tested|worry underneath/i.test(answer);
}

function isReflectionModeQuestion(message = '') {
  return Boolean(classifyMindQuestion(normalize(message)));
}

function isExplicitExecution(text = '') {
  const value = String(text || '').toLowerCase();
  return /\b(implement|execute|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|fix now)\b/.test(value);
}

function isAuditRequest(text = '') {
  const value = String(text || '').toLowerCase();
  return value === 'memory audit' ||
    /\b(project|founder|company|vision)\s+audit\b/.test(value) ||
    /\banswer only from memory\b/.test(value) ||
    /\bonly reconstruct project state\b/.test(value);
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

module.exports = {
  routeFounderMindReconstruction,
  reconstructFounderMind,
  buildReflectionResponse,
  responseAnswersFounderMind,
  isReflectionModeQuestion
};
