const REFLECTION_PATTERNS = [
  /\bwhy\s+(am\s+i|did\s+i)\s+(asking|ask)\b/i,
  /\bwhy\s+did\s+i\s+ask\s+that\b/i,
  /\bwhy\s+(am\s+i|i\s+am)\s+not\s+satisfied\b/i,
  /\bwhat\s+assumption\s+(am\s+i|i\s+am|am\s+i\s+holding|am\s+i\s+testing)\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+(worried|concerned)\s+about\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+testing\b/i,
  /\bwhat\s+is\s+my\s+(hidden\s+)?(concern|objective|intent)\b/i
];

const { buildDreamAlignment, formatDreamAlignment } = require('../dream-model');
const {
  buildStrategicThinking,
  formatStrategicThinking
} = require('../strategic-thinking-layer');
const {
  buildCuriosityPrompt,
  formatCuriosityPrompt
} = require('../curiosity-layer');

const VISION_PATTERNS = [
  /\b(are|r)\s+we\s+(even\s+)?(moving|going|heading)\s+(toward|towards|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(is|are)\s+(this|we)\s+aligned\s+(with|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(does|is)\s+this\s+(move|moving)\s+us\s+(toward|towards|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(are|r)\s+we\s+building\s+(the\s+)?(right|actual)\s+thing\b/i
];

const FOUNDER_QUESTION_PATTERNS = [
  /\bwhat\s+do\s+you\s+think\s+i'?m\s+(actually\s+)?(chasing|trying\s+to\s+build|trying\s+to\s+achieve|after)\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+(actually\s+)?(chasing|trying\s+to\s+build|trying\s+to\s+achieve|after)\b/i,
  /\bwhat\s+is\s+my\s+(real\s+)?(ambition|dream|goal|vision)\b/i,
  /\bwhat\s+do\s+you\s+think\s+my\s+(real\s+)?(ambition|dream|goal|vision)\s+is\b/i
];

const DOUBT_PATTERNS = [
  /\b(something|this|it)\s+(feels|feel)\s+(off|wrong|not right|missing|weak)\b/i,
  /\b(i\s+don'?t|i\s+do\s+not)\s+(like|feel)\s+(this|it)\b/i,
  /\b(not\s+satisfied|unsatisfied|dissatisfied)\b/i,
  /\b(focusing|focused|focus)\s+on\s+the\s+wrong\s+thing\b/i,
  /\b(wrong\s+thing|wrong\s+direction|misaligned|not\s+aligned)\b/i,
  /\b(i\s+think|i\s+feel|maybe|bro)\b.*\b(wrong\s+thing|wrong\s+direction|misaligned|off)\b/i,
  /\bwhy\s+(does\s+)?(this|it)\s+(not\s+feel|feel)\s+(valuable|useful|right|good|strong)\b/i
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

const CONTINUITY_PATTERNS = [
  /\bdid\s+we\s+(fix|solve|address|handle)\s+(that|it|this)\b/i,
  /\b(is|was)\s+(that|it|this)\s+(fixed|solved|addressed|handled)\b/i,
  /\bhave\s+we\s+(fixed|solved|addressed|handled)\s+(that|it|this)\b/i,
  /\bwhat\s+about\s+(that|it|this)\b/i,
  /\b(after|about)\s+that\b/i
];

const FORBIDDEN_REFLECTION_OUTPUT = /(Current Foundation Health|Momentum:\s*STALLED|Health:\s*\d+|Recommended Next Step|roadmap priority|Phase 1 foundation is protected|Team is ready|complexity report|Task Plan|Review Gate|TASK_PLAN|APPROVE|Execution Plan|Execution\b)/i;

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
      mode: reconstruction.mode,
      category: reconstruction.category,
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

  const kind = classifyMindQuestion(text, context.memory || {});
  if (!kind) return null;

  const report = buildMindReport(kind, original, context);
  const dreamAlignment = buildDreamAlignment({
    question: original,
    root: context.root,
    memoryLayer: context.memory && context.memory.founderMemoryLayer
  });
  const reconstruction = {
    mode: kind.mode,
    category: kind.category,
    intent: kind.intent,
    message: original,
    report,
    dreamAlignment,
    directAnswer: buildDirectAnswer(kind, report),
    strategicThinking: buildStrategicThinking({
      message: original,
      category: kind.category,
      intent: kind.intent,
      directAnswer: buildDirectAnswer(kind, report)
    }),
    curiosityPrompt: buildCuriosityPrompt({
      message: original,
      category: kind.category,
      intent: kind.intent,
      confidence: kind.confidence,
      concern: report.concern,
      objective: report.objective
    }),
    confidence: kind.confidence
  };

  return {
    ...reconstruction,
    selfCheck: responseAnswersFounderMind(reconstruction)
      ? 'answered the founder reason behind the question'
      : 'failed founder mind reconstruction; response must be regenerated'
  };
}

function classifyMindQuestion(text = '', memory = {}) {
  const continuityReference = resolveContinuityReference(text, memory);
  if (continuityReference) {
    return {
      intent: 'RESOLVE_FOUNDER_CONTINUITY_REFERENCE',
      category: 'STRATEGIC_DISCUSSION',
      archetype: 'continuity_reference',
      mode: 'FOUNDER_CONVERSATION_MODE',
      confidence: continuityReference.confidence,
      continuityReference
    };
  }

  if (DOUBT_PATTERNS.some((pattern) => pattern.test(text))) {
    const isStrategicDoubt = text.includes('wrong thing') ||
      text.includes('wrong direction') ||
      text.includes('misaligned') ||
      text.includes('direction');
    return {
      intent: isStrategicDoubt
        ? 'RECONSTRUCT_STRATEGIC_MISALIGNMENT_CONCERN'
        : 'RECONSTRUCT_PRODUCT_DISSATISFACTION',
      category: isStrategicDoubt
        ? 'DOUBT'
        : 'REFLECTION',
      archetype: isStrategicDoubt
        ? 'strategic_doubt'
        : 'dissatisfaction',
      mode: 'FOUNDER_CONVERSATION_MODE',
      confidence: 82
    };
  }

  if (REFLECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'RECONSTRUCT_FOUNDER_META_REASONING',
      category: 'REFLECTION',
      archetype: 'reflection',
      mode: 'REFLECTION_MODE',
      confidence: 86
    };
  }

  if (VISION_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'RECONSTRUCT_VISION_ALIGNMENT_CONCERN',
      category: 'VISION',
      archetype: 'vision_alignment',
      mode: 'FOUNDER_CONVERSATION_MODE',
      confidence: 84
    };
  }

  if (FOUNDER_QUESTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'RECONSTRUCT_FOUNDER_AMBITION',
      category: 'FOUNDER_QUESTION',
      archetype: 'founder_ambition',
      mode: 'FOUNDER_CONVERSATION_MODE',
      confidence: 85
    };
  }

  if (AGENT_UNDERSTANDING_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'ASSESS_AGENT_UNDERSTANDING_ANXIETY',
      category: 'REFLECTION',
      archetype: 'agent_understanding',
      mode: 'REFLECTION_MODE',
      confidence: 84
    };
  }

  if (AWARENESS_CHECK_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      intent: 'INTERPRET_AWARENESS_CHECK',
      category: 'REFLECTION',
      archetype: 'awareness_check',
      mode: 'REFLECTION_MODE',
      confidence: 78
    };
  }

  return null;
}

function buildMindReport(kind, message, context = {}) {
  if (kind.archetype === 'continuity_reference') {
    const reference = kind.continuityReference || resolveContinuityReference(message, context.memory || {});
    return {
      objective: 'Resolve a short follow-up against the previous founder concern instead of treating it as a vague new command.',
      assumption: 'The founder expects the agent to remember the prior concern semantically, not by keyword matching.',
      concern: reference && reference.concern
        ? reference.concern
        : 'The previous concern is not available with enough confidence.',
      decision: 'Decide whether the previous concern is actually resolved or still needs follow-up work.',
      desiredOutcome: 'Answer whether the remembered concern has been addressed and what remains unresolved.',
      actualQuestion: reference && reference.actualQuestion
        ? `Did we address this previous concern: ${reference.actualQuestion}`
        : 'Did we address the previous founder concern?',
      uselessLiteralAnswer: 'A generic clarification, task plan, health report, or fresh execution proposal.',
      continuitySource: reference
    };
  }

  if (kind.archetype === 'vision_alignment') {
    return {
      objective: 'Check whether current work is moving toward the founder dream rather than becoming agent infrastructure for its own sake.',
      assumption: 'The founder suspects the system is improving governance and plumbing, but may still be far from the actual personal intelligence layer.',
      concern: 'Aritenis may be becoming operationally elaborate without yet delivering the magical user outcome: phone-operated help that understands and completes real tasks.',
      decision: 'Decide whether to keep investing in infrastructure or shift attention toward the Explain/action-surface product proof.',
      desiredOutcome: 'An honest alignment judgment that separates useful infrastructure from the missing intelligence and execution experience.',
      actualQuestion: 'Are we building toward the long-term Aritenis dream, or just making the agents look busy?',
      uselessLiteralAnswer: 'A team-ready greeting, status block, health score, or task list.'
    };
  }

  if (kind.archetype === 'dissatisfaction') {
    return {
      objective: 'Explain the hidden product reason behind founder dissatisfaction.',
      assumption: 'The founder is testing whether technical completion equals real product value.',
      concern: 'The feature may work mechanically but fail to create a meaningful user outcome, emotional pull, or strategic differentiation.',
      decision: 'Decide whether this feature deserves more refinement, should be reframed, or should be deprioritized.',
      desiredOutcome: 'A direct diagnosis of the feature-value gap and what evidence would make the feature feel worth keeping.',
      actualQuestion: 'Why does this feature fail to satisfy me even if it technically works?',
      uselessLiteralAnswer: 'A health score, momentum report, complexity warning, or generic progress update.'
    };
  }

  if (kind.archetype === 'strategic_doubt') {
    return {
      objective: 'Understand whether the founder believes current effort is aimed at the wrong strategic target.',
      assumption: 'The founder suspects the agents may be improving infrastructure, governance, or agent mechanics instead of moving closer to the killer feature.',
      concern: 'The company could spend time making the system look operational while delaying the product moment that users would actually care about.',
      decision: 'Decide whether to continue current infrastructure work or redirect effort toward the highest-leverage product wedge.',
      desiredOutcome: 'A strategic conversation about possible misalignment, not an execution plan or file-change proposal.',
      actualQuestion: 'Are we focusing on work that moves Aritenis toward the founder objective, or are we optimizing the wrong layer?',
      uselessLiteralAnswer: 'A task plan, approve token, file list, validation command, risk block, or engineering report.'
    };
  }

  if (kind.archetype === 'founder_ambition') {
    return {
      objective: 'Reconstruct the founder ambition behind the question instead of treating it as a status or task request.',
      assumption: 'The founder is testing whether the agents understand the real company dream beyond files, governance, and short-term tasks.',
      concern: 'The agents may know project facts but still miss the emotional and strategic ambition: building a personal intelligence layer people actually rely on.',
      decision: 'Decide whether current work should be judged as company-building progress or just tooling progress.',
      desiredOutcome: 'A direct explanation of the founder ambition and how current work should be judged against it.',
      actualQuestion: 'What long-term outcome am I really chasing with Aritenis?',
      uselessLiteralAnswer: 'A team-ready response, health score, task plan, approval token, or execution update.'
    };
  }

  if (kind.archetype === 'agent_understanding') {
    return {
      objective: 'Check whether the agents can reason from founder vision instead of repeating memory or templates.',
      assumption: 'The founder suspects the deployed agents may still be keyword routers with founder-memory retrieval attached.',
      concern: 'If the agents only summarize the project, they cannot be trusted to operate while the founder is absent.',
      decision: 'Decide whether the agents are ready for more responsibility or need deeper reasoning fixes first.',
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
      decision: 'Decide whether the founder needs a natural awareness answer or an evidence-backed operational status answer.',
      desiredOutcome: 'A short answer that explains the likely context and offers evidence-backed status only if requested.',
      actualQuestion: 'Are you aware of what I am trying to check right now?',
      uselessLiteralAnswer: 'A health, momentum, or roadmap report without explaining the inferred concern.'
    };
  }

  return {
    objective: 'Understand the reason behind the founder question instead of answering the literal words.',
    assumption: 'The founder is testing whether the agent can reconstruct hidden intent before routing.',
    concern: 'The current agent may still be a template selector that misses worry, doubt, and evaluation pressure.',
    decision: 'Decide what answer would help the founder make the next judgment instead of merely satisfying a keyword route.',
    desiredOutcome: 'A direct reconstruction of the hidden objective, assumption, concern, and satisfying answer.',
    actualQuestion: 'What am I really trying to learn by asking this?',
    uselessLiteralAnswer: 'A generic status, health, momentum, or roadmap response.'
  };
}

function buildDirectAnswer(kind, report) {
  if (kind.archetype === 'continuity_reference') {
    const source = report.continuitySource || {};
    const topic = source.concern || source.objective || 'the previous concern';
    return [
      `Yes, "that" most likely refers to the previous concern: ${topic}`,
      'I should not treat this as a new task or ask what "that" means unless the memory is weak.',
      'My honest answer: partially addressed if the conversation route now stays strategic, but not fully fixed until repeated WhatsApp tests stop producing task plans or approval tokens for the same kind of doubt.',
      'What remains: keep testing follow-up questions and make sure the agent links them to the same concern without keyword matching.'
    ];
  }

  if (kind.archetype === 'vision_alignment') {
    return [
      'Partially.',
      'We are moving toward the dream in the sense that the foundation, governance, WhatsApp access, memory, Product Lab, and agent rails are being built.',
      'But we are not yet close enough to the dream itself: a phone-operated personal intelligence layer that can understand the founder, inspect the product, reason about real evidence, and help complete meaningful actions.',
      'The gap is intelligence and user leverage, not more templates.',
      'So the honest answer is: the direction is aligned, but the current center of gravity is still infrastructure. The next proof has to be a real Explain/action-surface moment that feels useful, not another governance improvement.'
    ];
  }

  if (kind.archetype === 'dissatisfaction') {
    return [
      'You may be dissatisfied because the feature works technically but does not yet create a meaningful user outcome.',
      'That usually means the implementation exists, but the value gap is still open: it does not feel magical, necessary, or clearly better than doing nothing.',
      `The hidden concern is: ${report.concern}`,
      'A satisfying feature should make the user feel more capable in the moment, not just prove that the system can route, report, or execute.',
      'So the right question is probably: what user pain did this remove, and would anyone miss it if we removed it tomorrow?'
    ];
  }

  if (kind.archetype === 'strategic_doubt') {
    return [
      'You may be worried that we are spending time improving infrastructure instead of getting closer to the killer feature.',
      'That concern is valid to test. Governance, memory, routing, and agent councils only matter if they help Aritenis reach the founder objective faster.',
      'The likely misalignment is this: the system may be getting better at operating itself, while the product still needs a clearer user-facing breakthrough.',
      'So I would treat this as a strategic discussion, not a task request.',
      'The useful next question is: what current work most directly moves us toward the Explain action-surface moment users would actually feel?'
    ];
  }

  if (kind.archetype === 'founder_ambition') {
    return [
      'You are chasing more than a keyboard feature.',
      'You are trying to build a personal intelligence layer that lives where people already act: the phone, the keyboard, screenshots, messages, and daily workflows.',
      'The deeper ambition is a Jarvis-style product, but grounded in trust: it should understand context, help complete real actions, and stay private and controllable.',
      'That means the company should be judged by whether Aritenis helps users understand and act faster, not by whether the agent system looks complex.',
      'So the honest reconstruction is: you are chasing leverage, trust, and a product people would miss if it disappeared.'
    ];
  }

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

  if (reconstruction.dreamAlignment) {
    lines.push('');
    lines.push(formatDreamAlignment(reconstruction.dreamAlignment));
  }

  if (reconstruction.strategicThinking) {
    lines.push('');
    lines.push(formatStrategicThinking(reconstruction.strategicThinking));
  }

  const curiosity = formatCuriosityPrompt(reconstruction.curiosityPrompt);
  if (curiosity) {
    lines.push('');
    lines.push(curiosity);
  }

  if (debug) {
    lines.push('');
    lines.push('Mind reconstruction:');
    lines.push(`Objective: ${reconstruction.report.objective}`);
    lines.push(`Assumption: ${reconstruction.report.assumption}`);
    lines.push(`Concern: ${reconstruction.report.concern}`);
    lines.push(`Decision: ${reconstruction.report.decision}`);
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
  if (!report.objective || !report.assumption || !report.concern || !report.decision || !report.desiredOutcome || !report.actualQuestion) {
    return false;
  }
  if (reconstruction.intent === 'ASSESS_AGENT_UNDERSTANDING_ANXIETY') {
    return /not asking for a project summary|understand fragments|evidence proves understanding/i.test(answer);
  }
  if (reconstruction.intent === 'INTERPRET_AWARENESS_CHECK') {
    return /context-aware|keywords|health report|awareness/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_VISION_ALIGNMENT_CONCERN') {
    return /partially|dream|personal intelligence layer|infrastructure|aligned/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_PRODUCT_DISSATISFACTION') {
    return /dissatisfied|meaningful user outcome|value gap|hidden concern/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_STRATEGIC_MISALIGNMENT_CONCERN') {
    return /wrong thing|infrastructure|killer feature|misalignment|founder objective|strategic discussion/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_AMBITION') {
    return /personal intelligence layer|phone|keyboard|screenshots|trust|leverage|miss if it disappeared/i.test(answer);
  }
  if (reconstruction.intent === 'RESOLVE_FOUNDER_CONTINUITY_REFERENCE') {
    return /most likely refers|previous concern|partially addressed|what remains/i.test(answer);
  }
  return /reason behind your words|assumption being tested|worry underneath/i.test(answer);
}

function resolveContinuityReference(message = '', memory = {}) {
  if (!CONTINUITY_PATTERNS.some((pattern) => pattern.test(String(message || '')))) return null;
  const candidates = [
    memory.lastFounderConcern,
    first(memory.founderConcerns),
    first(memory.founderDoubts),
    memory.semanticFounderState && memory.semanticFounderState.unresolvedReference
      ? {
          concern: memory.semanticFounderState.unresolvedReference,
          objective: memory.semanticFounderState.founderGoal,
          actualQuestion: memory.semanticFounderState.unresolvedReference,
          category: 'SEMANTIC_MEMORY'
        }
      : null,
    memory.unresolvedReference
      ? {
          concern: memory.unresolvedReference,
          objective: memory.founderGoal,
          actualQuestion: memory.unresolvedReference,
          category: 'UNRESOLVED_REFERENCE'
        }
      : null
  ].filter(Boolean);
  const candidate = candidates[0];
  if (!candidate) return null;
  return {
    ...candidate,
    confidence: candidate.category === 'SEMANTIC_MEMORY' || candidate.category === 'UNRESOLVED_REFERENCE' ? 72 : 86
  };
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

function first(items) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

module.exports = {
  routeFounderMindReconstruction,
  reconstructFounderMind,
  buildReflectionResponse,
  responseAnswersFounderMind,
  isReflectionModeQuestion,
  resolveContinuityReference
};
