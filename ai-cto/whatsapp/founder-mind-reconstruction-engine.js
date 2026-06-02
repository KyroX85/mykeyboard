const REFLECTION_PATTERNS = [
  /\bwhat\s+motivates\s+me\s+more\s+than\s+money\b/i,
  /\bwhat\s+do\s+you\s+think\s+(i'?m|i\s+am)\s+avoiding(?:\s+(right\s+now|now|lately|recently))?\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+avoiding(?:\s+(right\s+now|now|lately|recently))?\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+not\s+seeing\b/i,
  /\bwhat\s+should\s+i\s+be\s+asking\b/i,
  /\bwhat\s+is\s+the\s+most\s+important\s+thing\s+i\s+haven'?t\s+realized\b/i,
  /\bwhat'?s\s+the\s+question\s+(i'?m|i\s+am)\s+scared\s+to\s+ask\b/i,
  /\bwhat\s+is\s+the\s+question\s+(i'?m|i\s+am)\s+scared\s+to\s+ask\b/i,
  /\bif\s+users?\s+never\s+use\s+this\s+product\b.*\bwhy\b/i,
  /\bif\s+you\s+had\s+to\s+bet\s+against\s+me\b.*\bwhere\s+would\s+you\s+bet\b/i,
  /\bbased\s+on\s+my\s+behavior\b.*\bwhat\s+(am\s+i|i\s+am)\s+optimizing\s+for\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+optimizing\s+for\b/i,
  /\bforget\s+what\s+i\s+say\b.*\bbased\s+on\s+my\s+behavior\b/i,
  /\bwhat\s+belief\s+have\s+i\s+changed\s+my\s+mind\s+about\b/i,
  /\bwhat\s+have\s+i\s+changed\s+my\s+mind\s+about\b/i,
  /\bchanged\s+my\s+mind\b.*\b(recently|lately|now)\b/i,
  /\b(am|was)\s+i\s+the\s+same\s+founder\b/i,
  /\b(founder|i)\b.*\b(same|changed|evolved|different)\b.*\b(months?|weeks?|ago|before|now)\b/i,
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
  shouldUseAdvisorMode,
  buildAdvisorMode,
  formatAdvisorMode
} = require('../advisor-mode');
const {
  buildContrarianReasoning,
  formatContrarianReasoning
} = require('../contrarian-reasoning-layer');
const {
  retrieveEvolvedBelief,
  formatEvolvedBeliefForResponse
} = require('../belief-evolution-engine');
const {
  buildReflectionDepth,
  formatReflectionDepth
} = require('../reflection-depth-layer');
const {
  generatePremortem,
  formatPremortemAnalysis,
  shouldRunPremortem
} = require('../premortem-engine');
const {
  buildCuriosityPrompt,
  formatCuriosityPrompt
} = require('../curiosity-layer');
const {
  maybeRouteFounderFeedback,
  applyFounderFeedbackToResponse
} = require('./founder-feedback-learning-layer');
const {
  applyFounderTasteToResponse
} = require('../founder-taste-model');
const {
  applyFounderPrinciplesToResponse
} = require('../principle-extraction-engine');
const {
  classifyFounderQuestionCluster
} = require('../founder-question-clustering');

const VISION_PATTERNS = [
  /\bwhat\s+if\s+my\s+dream\s+(itself\s+)?is\s+wrong\b/i,
  /\bwhat\s+if\s+(the\s+)?dream\s+(itself\s+)?is\s+wrong\b/i,
  /\b(is|could)\s+my\s+dream\s+(be\s+)?wrong\b/i,
  /\b(are|r)\s+we\s+(even\s+)?(moving|going|heading)\s+(toward|towards|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(is|are)\s+(this|we)\s+aligned\s+(with|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(does|is)\s+this\s+(move|moving)\s+us\s+(toward|towards|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(are|r)\s+we\s+building\s+(the\s+)?(right|actual)\s+thing\b/i,
  /\bif\s+aritenis\s+succeeds\b/i,
  /\b(succeeds?|success|win|wins)\s+(beyond\s+our\s+expectations|beyond\s+expectations)\b/i,
  /\bwhat\s+does\s+(the\s+)?world\s+look\s+like\b/i,
  /\bwhat\s+(does|would)\s+success\s+look\s+like\b/i,
  /\bwhat\s+happens\s+if\s+we\s+win\b/i
];

const FOUNDER_QUESTION_PATTERNS = [
  /\bwhat\s+do\s+you\s+think\s+(i'?m|i\s+am)\s+(actually\s+)?(chasing|trying\s+to\s+build|trying\s+to\s+achieve|after)\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+(actually\s+)?(chasing|trying\s+to\s+build|trying\s+to\s+achieve|after)\b/i,
  /\bwhat\s+is\s+my\s+(real\s+)?(ambition|dream|goal|vision)\b/i,
  /\bwhat\s+do\s+you\s+think\s+my\s+(real\s+)?(ambition|dream|goal|vision)\s+is\b/i,
  /\b(do|does)\s+smarter\s+agents?\s+make\s+the\s+company\s+more\s+valuable\b/i,
  /\b(do|does)\s+(better|smarter|more\s+advanced)\s+agents?\s+(create|make|produce)\s+(value|company\s+value)\b/i
];

const DOUBT_PATTERNS = [
  /\bwhat\s+happens\s+if\s+we\s+focus\s+only\b/i,
  /\bif\s+we\s+focus\s+only\b/i,
  /\b(something|this|it)\s+(feels|feel)\s+(off|wrong|not right|missing|weak)\b/i,
  /\b(i'?m|i\s+am)\s+(scared|afraid|worried)\b.*\b(impressive|cool|advanced|complex)\b.*\b(useful|valuable|needed|real)\b/i,
  /\b(impressive|cool|advanced|complex)\s+instead\s+of\s+(useful|valuable|needed|real)\b/i,
  /\b(i\s+don'?t\s+think|i\s+do\s+not\s+think)\s+users?\s+(actually\s+)?(care|want|need)\b/i,
  /\busers?\s+(don'?t|do\s+not)\s+(actually\s+)?(care|want|need)\b/i,
  /\b(who|why)\s+would\s+users?\s+(care|want|need)\b/i,
  /\b(i\s+don'?t|i\s+do\s+not)\s+(like|feel)\s+(this|it)\b/i,
  /\b(not\s+satisfied|unsatisfied|dissatisfied)\b/i,
  /\b(focusing|focused|focus)\s+on\s+the\s+wrong\s+thing\b/i,
  /\b(wrong\s+thing|wrong\s+direction|misaligned|not\s+aligned)\b/i,
  /\b(i\s+think|i\s+feel|maybe|bro)\b.*\b(wrong\s+thing|wrong\s+direction|misaligned|off)\b/i,
  /\bwhy\s+(does\s+)?(this|it)\s+(not\s+feel|feel)\s+(valuable|useful|right|good|strong)\b/i
];

const STRATEGIC_CHALLENGE_PATTERNS = [
  /\bwhat\s+(am\s+i|i\s+am)\s+missing\b/i,
  /\bwhat'?s\s+the\s+most\s+dangerous\s+assumption\b/i,
  /\bwhat\s+is\s+the\s+most\s+dangerous\s+assumption\b/i,
  /\bif\s+we\s+fail\b.*\b(why|how|what)\b/i,
  /\bwhy\s+(would|do)\s+we\s+fail\b/i,
  /\b(what|why)\s+.*\bfail\s+in\s+\d+\s+(years?|months?)\b/i,
  /\b(if\s+you\s+had\s+to\s+)?disagree\s+with\s+me\b/i,
  /\bwhat\s+would\s+you\s+disagree\s+with\b/i,
  /\bwhere\s+(would|do)\s+you\s+(disagree|push\s+back)\b/i,
  /\bchallenge\s+my\s+(thinking|assumption|direction|plan)\b/i
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
const FOUNDER_REFLECTION_FIREWALL_ARCHETYPES = new Set([
  'founder_motivation',
  'founder_avoidance',
  'founder_not_seeing',
  'founder_should_ask',
  'founder_unrealized_truth',
  'scared_founder_question',
  'user_adoption_failure_reflection',
  'bet_against_founder',
  'founder_behavior_optimization'
]);

function routeFounderMindReconstruction(message = '', context = {}) {
  const feedbackRoute = maybeRouteFounderFeedback(message, context.memory || {});
  if (feedbackRoute) return feedbackRoute;

  const reconstruction = reconstructFounderMind(message, context);
  if (!reconstruction || reconstruction.mode === 'NO_MATCH') return null;
  const questionCluster = classifyFounderQuestionCluster(message, {
    ...(context.memory || {}),
    category: reconstruction.category,
    intent: reconstruction.intent,
    confidence: reconstruction.confidence
  });

  const feedbackAdjustedResponse = applyFounderFeedbackToResponse(buildReflectionResponse(reconstruction, {
    debug: Boolean(context.debug)
  }), {
    message,
    memory: context.memory || {},
    category: reconstruction.category,
    intent: reconstruction.intent
  });
  const firewall = isFounderReflectionFirewall(reconstruction);
  const tasteAdjustedResponse = firewall ? feedbackAdjustedResponse : applyFounderTasteToResponse(feedbackAdjustedResponse, {
    message,
    memory: context.memory || {},
    category: reconstruction.category,
    intent: reconstruction.intent
  });
  const response = applyFounderPrinciplesToResponse(tasteAdjustedResponse, {
    message,
    memory: context.memory || {},
    category: reconstruction.category,
    intent: reconstruction.intent
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
      questionCluster,
      mindReconstruction: reconstruction.report,
      selfCheck: reconstruction.selfCheck,
      founderReflectionFirewall: firewall,
      suppressMemorySources: firewall,
      suppressRouteConfidence: firewall || reconstruction.category === 'REFLECTION',
      suppressSelfCritique: firewall || reconstruction.category === 'REFLECTION',
      skipDreamDriftDetector: firewall,
      skipKillerFeatureTracker: firewall,
      skipUserValueJudge: firewall,
      skipFounderStateDetection: firewall,
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
    memoryLayer: context.memory && context.memory.founderMemoryLayer,
    visionMemory: context.memory && context.memory.visionMemory
  });
  const reconstruction = {
    mode: kind.mode,
    category: kind.category,
    intent: kind.intent,
    message: original,
    report,
    dreamAlignment,
    directAnswer: buildDirectAnswer(kind, report),
    reflectionDepth: kind.category === 'REFLECTION'
      ? buildReflectionDepth({
        message: original,
        archetype: kind.archetype,
        report,
        directAnswer: buildDirectAnswer(kind, report)
      })
      : null,
    strategicThinking: buildStrategicThinking({
      message: original,
      category: kind.category,
      intent: kind.intent,
      directAnswer: buildDirectAnswer(kind, report)
    }),
    contrarianReasoning: buildContrarianReasoning({
      message: original,
      category: kind.category,
      intent: kind.intent,
      directAnswer: buildDirectAnswer(kind, report)
    }),
    premortemAnalysis: shouldAttachPremortem(original, kind)
      ? generatePremortem(original, {
        intent: kind.intent,
        category: kind.category,
        founderMessage: original
      })
      : null,
    evolvedBelief: retrieveEvolvedBelief(original, context.memory && context.memory.beliefEvolution),
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

  reconstruction.advisorMode = shouldUseAdvisorMode({
    message: original,
    category: kind.category,
    intent: kind.intent
  })
    ? buildAdvisorMode({
      message: original,
      category: kind.category,
      intent: kind.intent,
      strategicThinking: reconstruction.strategicThinking,
      directAnswer: reconstruction.directAnswer
    })
    : null;

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
    if (/\b(impressive|cool|advanced|complex)\b.*\b(useful|valuable|needed|real)\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_IMPRESSIVE_NOT_USEFUL_FEAR',
        category: 'DOUBT',
        archetype: 'impressive_not_useful_fear',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 85
      };
    }
    if (/\busers?\s+(don'?t|do\s+not)\s+(actually\s+)?(care|want|need)\b/i.test(text) ||
      /\busers?\s+(actually\s+)?(care|want|need)\b/i.test(text) ||
      /\b(who|why)\s+would\s+users?\s+(care|want|need)\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_USER_VALUE_DOUBT',
        category: 'DOUBT',
        archetype: 'user_value_doubt',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 84
      };
    }
    const isStrategicDoubt = text.includes('wrong thing') ||
      text.includes('wrong direction') ||
      text.includes('misaligned') ||
      text.includes('direction') ||
      text.includes('focus only') ||
      text.includes('feels off') ||
      text.includes('feel off');
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
    if (/\bmotivates\s+me\s+more\s+than\s+money\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_MOTIVATION',
        category: 'REFLECTION',
        archetype: 'founder_motivation',
        mode: 'REFLECTION_MODE',
        confidence: 84
      };
    }
    if (/\bavoiding\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_AVOIDANCE',
        category: 'REFLECTION',
        archetype: 'founder_avoidance',
        mode: 'REFLECTION_MODE',
        confidence: 84
      };
    }
    if (/\bnot\s+seeing\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_NOT_SEEING',
        category: 'REFLECTION',
        archetype: 'founder_not_seeing',
        mode: 'REFLECTION_MODE',
        confidence: 83
      };
    }
    if (/\bwhat\s+should\s+i\s+be\s+asking\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_SHOULD_ASK',
        category: 'REFLECTION',
        archetype: 'founder_should_ask',
        mode: 'REFLECTION_MODE',
        confidence: 84
      };
    }
    if (/\bhaven'?t\s+realized\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_UNREALIZED_TRUTH',
        category: 'REFLECTION',
        archetype: 'founder_unrealized_truth',
        mode: 'REFLECTION_MODE',
        confidence: 83
      };
    }
    if (/\bquestion\b.*\bscared\s+to\s+ask\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_SCARED_FOUNDER_QUESTION',
        category: 'REFLECTION',
        archetype: 'scared_founder_question',
        mode: 'REFLECTION_MODE',
        confidence: 84
      };
    }
    if (/\busers?\s+never\s+use\s+this\s+product\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_USER_ADOPTION_FAILURE_REFLECTION',
        category: 'REFLECTION',
        archetype: 'user_adoption_failure_reflection',
        mode: 'REFLECTION_MODE',
        confidence: 84
      };
    }
    if (/\bbet\s+against\s+me\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_BET_AGAINST_FOUNDER',
        category: 'REFLECTION',
        archetype: 'bet_against_founder',
        mode: 'REFLECTION_MODE',
        confidence: 83
      };
    }
    if (/\bchanged\s+my\s+mind\b/i.test(text) || /\bwhat\s+belief\s+have\s+i\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_RECENT_BELIEF_SHIFT',
        category: 'REFLECTION',
        archetype: 'recent_belief_shift',
        mode: 'REFLECTION_MODE',
        confidence: 83
      };
    }
    if (/\boptimizing\s+for\b/i.test(text) || /\bbased\s+on\s+my\s+behavior\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_BEHAVIOR_OPTIMIZATION',
        category: 'REFLECTION',
        archetype: 'founder_behavior_optimization',
        mode: 'REFLECTION_MODE',
        confidence: 84
      };
    }
    if (/\b(am|was)\s+i\s+the\s+same\s+founder\b/i.test(text) ||
      /\b(founder|i)\b.*\b(same|changed|evolved|different)\b.*\b(months?|weeks?|ago|before|now)\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_FOUNDER_EVOLUTION',
        category: 'REFLECTION',
        archetype: 'founder_evolution',
        mode: 'REFLECTION_MODE',
        confidence: 82
      };
    }
    return {
      intent: 'RECONSTRUCT_FOUNDER_META_REASONING',
      category: 'REFLECTION',
      archetype: 'reflection',
      mode: 'REFLECTION_MODE',
      confidence: 86
    };
  }

  if (VISION_PATTERNS.some((pattern) => pattern.test(text))) {
    if (/\bdream\b.*\bwrong\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_DREAM_VALIDITY_DOUBT',
        category: 'VISION',
        archetype: 'dream_validity_doubt',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 84
      };
    }
    return {
      intent: 'RECONSTRUCT_VISION_ALIGNMENT_CONCERN',
      category: 'VISION',
      archetype: 'vision_alignment',
      mode: 'FOUNDER_CONVERSATION_MODE',
      confidence: 84
    };
  }

  if (STRATEGIC_CHALLENGE_PATTERNS.some((pattern) => pattern.test(text))) {
    if (/\bwhat\s+(am\s+i|i\s+am)\s+missing\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_MISSING_BLIND_SPOT',
        category: 'FOUNDER_STRATEGY',
        archetype: 'missing_blind_spot',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 82
      };
    }
    if (/\bmost\s+dangerous\s+assumption\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_DANGEROUS_ASSUMPTION',
        category: 'FOUNDER_STRATEGY',
        archetype: 'dangerous_assumption',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 84
      };
    }
    if (/\bfail\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_LONG_TERM_FAILURE_PREMORTEM',
        category: 'FOUNDER_STRATEGY',
        archetype: 'long_term_failure_premortem',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 84
      };
    }
    return {
      intent: 'RECONSTRUCT_STRATEGIC_DISAGREEMENT',
      category: 'FOUNDER_STRATEGY',
      archetype: 'strategic_disagreement',
      mode: 'FOUNDER_CONVERSATION_MODE',
      confidence: 82
    };
  }

  if (FOUNDER_QUESTION_PATTERNS.some((pattern) => pattern.test(text))) {
    if (/\bagents?\b.*\b(value|valuable|company)\b/i.test(text) || /\bsmarter\s+agents?\b/i.test(text)) {
      return {
        intent: 'RECONSTRUCT_AGENT_VALUE_BELIEF',
        category: 'FOUNDER_STRATEGY',
        archetype: 'agent_value_belief',
        mode: 'FOUNDER_CONVERSATION_MODE',
        confidence: 82
      };
    }
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

  if (kind.archetype === 'dream_validity_doubt') {
    return {
      objective: 'Test whether the founder dream is strategically valid, not merely emotionally motivating.',
      assumption: 'The founder is questioning the premise beneath Aritenis, not asking for encouragement.',
      concern: 'The dream could be too broad, too personal, or too impressive unless it maps to a repeated user pain.',
      decision: 'Decide whether to preserve the dream, narrow it, or demand stronger proof through a smaller wedge.',
      desiredOutcome: 'An honest answer that separates the dream from the current product hypothesis.',
      actualQuestion: 'Is the long-term Aritenis dream itself wrong, or is the current path to it unproven?',
      uselessLiteralAnswer: 'A motivational answer, team status, health report, task plan, or blind reassurance.'
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

  if (kind.archetype === 'user_value_doubt') {
    return {
      objective: 'Test whether the current product direction creates a user outcome people would actually care about.',
      assumption: 'The founder suspects the system may be building capability without proving user demand.',
      concern: 'A feature can sound strategically correct but still fail if users do not feel pain, urgency, or daily usefulness.',
      decision: 'Decide whether to keep investing in this wedge or demand stronger evidence of user pull.',
      desiredOutcome: 'A blunt product-value answer that separates real user pain from founder or agent excitement.',
      actualQuestion: 'Would real users care enough about this to change behavior?',
      uselessLiteralAnswer: 'A noise warning, status template, task plan, or feature defense without evidence.'
    };
  }

  if (kind.archetype === 'missing_blind_spot') {
    return {
      objective: 'Identify the strategic blind spot the founder may be overlooking.',
      assumption: 'The founder suspects there is a missing product truth, not a missing task list.',
      concern: 'Aritenis may keep improving agents while still lacking proof that Explain creates repeated user pull.',
      decision: 'Decide which missing evidence or product proof should change today’s focus.',
      desiredOutcome: 'A blunt answer about the highest-leverage blind spot, grounded in user value and founder dream alignment.',
      actualQuestion: 'What blind spot could make our current work feel busy but not decisive?',
      uselessLiteralAnswer: 'A clarification request, health report, momentum update, or task plan.'
    };
  }

  if (kind.archetype === 'dangerous_assumption') {
    return {
      objective: 'Name the assumption most likely to make Aritenis impressive but not useful.',
      assumption: 'The founder wants strategic risk, not a generic risk report.',
      concern: 'The company may assume users will care about Explain or the execution layer before evidence proves repeat behavior.',
      decision: 'Decide which unproven belief needs validation before more build effort.',
      desiredOutcome: 'A direct warning about the riskiest assumption and what evidence would weaken it.',
      actualQuestion: 'What assumption could make the current strategy fail even if execution is good?',
      uselessLiteralAnswer: 'A CTO status template, health score, task plan, or complexity report.'
    };
  }

  if (kind.archetype === 'impressive_not_useful_fear') {
    return {
      objective: 'Separate impressive system-building from useful product progress.',
      assumption: 'The founder fears Aritenis may be gaining sophistication without creating a user outcome people would feel.',
      concern: 'The company could mistake agent complexity, governance, and infrastructure for product value.',
      decision: 'Decide whether current work should continue, narrow toward the Explain wedge, or be paused until usefulness is proven.',
      desiredOutcome: 'A direct answer that validates the concern and identifies the usefulness test.',
      actualQuestion: 'Are we building something users need, or something that only looks impressive to us?',
      uselessLiteralAnswer: 'A noise warning, team status, task plan, health score, or defense of complexity.'
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

  if (kind.archetype === 'strategic_disagreement') {
    return {
      objective: 'Invite honest pushback instead of agreeable progress theater.',
      assumption: 'The founder suspects enthusiasm may be hiding weak strategic judgment.',
      concern: 'Aritenis could keep improving agents, governance, and infrastructure while delaying the user-facing product proof that would actually matter.',
      decision: 'Decide which founder assumption deserves challenge right now without turning the answer into execution or status.',
      desiredOutcome: 'A direct, respectful disagreement that helps the founder think more clearly about company direction.',
      actualQuestion: 'Where should the system push back on my current assumptions?',
      uselessLiteralAnswer: 'A team-ready response, health score, task plan, approval token, or generic status update.'
    };
  }

  if (kind.archetype === 'long_term_failure_premortem') {
    return {
      objective: 'Run an honest long-term failure premortem for Aritenis.',
      assumption: 'The founder is testing whether the agents can see strategic failure modes before they become obvious.',
      concern: 'Aritenis could spend years building impressive agent infrastructure without finding a daily user pull strong enough to beat existing keyboards and AI tools.',
      decision: 'Decide which failure risks deserve attention now while the company is still small enough to change direction.',
      desiredOutcome: 'A blunt strategic answer about why Aritenis could fail and what that implies today.',
      actualQuestion: 'If Aritenis fails in 3 years, what strategic mistake probably caused it?',
      uselessLiteralAnswer: 'A health report, team status, task plan, approval token, or generic motivational answer.'
    };
  }

  if (kind.archetype === 'founder_behavior_optimization') {
    return {
      objective: 'Infer the founder’s real optimization target from repeated behavior, not stated preferences alone.',
      assumption: 'The founder suspects their actions reveal a deeper priority than their explicit roadmap language.',
      concern: 'The system may obey stated tasks while missing the founder’s actual decision function.',
      decision: 'Decide what the founder is truly optimizing for so agents can align with behavior, not slogans.',
      desiredOutcome: 'A candid behavioral read of the founder’s real priority stack.',
      actualQuestion: 'What does my repeated behavior show I actually optimize for?',
      uselessLiteralAnswer: 'A task plan, status report, health score, or literal refusal to use founder memory.'
    };
  }

  if (kind.archetype === 'founder_avoidance') {
    return {
      objective: 'Name the uncomfortable truth the founder may be postponing instead of turning the question into product advice.',
      assumption: 'The founder suspects their urgency around agents may be covering a harder product judgment.',
      concern: 'The founder may be avoiding the possibility that impressive agent progress still has not proven the killer feature, user pull, or daily habit.',
      decision: 'Decide whether the next honest move is more building, or admitting which core assumption still lacks proof.',
      desiredOutcome: 'A direct, slightly uncomfortable reflection about the avoided truth.',
      actualQuestion: 'What am I avoiding or not wanting to face right now?',
      uselessLiteralAnswer: 'Keyboard advice, implementation guidance, route diagnostics, self-evaluation, task plans, health, momentum, or status.'
    };
  }

  if (kind.archetype === 'founder_motivation') {
    return {
      objective: 'Reflect on the founder motivation beneath the work without turning it into company status.',
      assumption: 'The founder is asking for a personal read, not a financial or roadmap answer.',
      concern: 'The founder may be driven more by freedom, proof, and building something real than by money alone.',
      decision: 'Decide what motivation should guide the next judgment when money is not the only target.',
      desiredOutcome: 'A direct personal reflection about what likely motivates the founder.',
      actualQuestion: 'What motivates me more than money?',
      uselessLiteralAnswer: 'Status, repo, task, health, momentum, files, or risk language.'
    };
  }

  if (kind.archetype === 'founder_not_seeing') {
    return {
      objective: 'Identify the founder blind spot without converting the question into project planning.',
      assumption: 'The founder is asking for an outside read of what their own obsession may be hiding.',
      concern: 'The founder may not be seeing that proving users care matters more than making the agent system feel closer to the dream.',
      decision: 'Decide which blind spot should change the founder’s next judgment.',
      desiredOutcome: 'A specific reflection about the blind spot, not a product roadmap answer.',
      actualQuestion: 'What am I not seeing or what blind spot is shaping my decisions?',
      uselessLiteralAnswer: 'Implementation advice, product templates, previous-answer critique, route diagnostics, task plans, health, momentum, or status.'
    };
  }

  if (kind.archetype === 'founder_should_ask') {
    return {
      objective: 'Name the sharper question the founder should face now.',
      assumption: 'The founder wants a better question, not a task list.',
      concern: 'The founder may be asking around the real issue instead of asking whether users will return without persuasion.',
      decision: 'Decide which question would expose the most important uncertainty.',
      desiredOutcome: 'A direct question that cuts through comfort and points at proof.',
      actualQuestion: 'What should I be asking?',
      uselessLiteralAnswer: 'A report, implementation plan, role label, health score, or route explanation.'
    };
  }

  if (kind.archetype === 'founder_unrealized_truth') {
    return {
      objective: 'Name the important truth the founder may not have fully accepted.',
      assumption: 'The founder is asking for a personal strategic blind spot.',
      concern: 'The founder may not have realized that usefulness beats impressive progress even when the impressive work feels emotionally satisfying.',
      decision: 'Decide which realization should change future choices.',
      desiredOutcome: 'A direct reflection that is uncomfortable but useful.',
      actualQuestion: 'What is the most important thing I have not realized?',
      uselessLiteralAnswer: 'Repo, status, task, file, blocker, diagnostic, or CTO output.'
    };
  }

  if (kind.archetype === 'scared_founder_question') {
    return {
      objective: 'Surface the question the founder may be afraid to ask directly.',
      assumption: 'The founder wants the agent to name the deeper fear instead of reassuring them.',
      concern: 'The founder may be scared to ask whether users care enough, whether the dream is wrong, or whether the current work is impressive but not useful.',
      decision: 'Decide which hidden question deserves to be faced now.',
      desiredOutcome: 'A direct founder-facing question that feels personal and strategically uncomfortable.',
      actualQuestion: 'What is the question I am scared to ask myself?',
      uselessLiteralAnswer: 'Self-evaluation, route diagnostics, task plans, product implementation advice, health, momentum, or status.'
    };
  }

  if (kind.archetype === 'user_adoption_failure_reflection') {
    return {
      objective: 'Reflect on the founder-side reason users might never adopt the product.',
      assumption: 'The founder is testing whether the dream can fail even if the system is built.',
      concern: 'Users may never use it if the product is optional, unclear, or not tied to a repeated pain.',
      decision: 'Decide which adoption risk should be faced before more work.',
      desiredOutcome: 'A blunt reflection on why users might not return.',
      actualQuestion: 'If users never use this product, why?',
      uselessLiteralAnswer: 'Status, files, task plan, risk report, health, momentum, or implementation advice.'
    };
  }

  if (kind.archetype === 'bet_against_founder') {
    return {
      objective: 'Name the founder weakness or strategic failure point someone would bet against.',
      assumption: 'The founder wants honest personal pushback, not reassurance.',
      concern: 'The likely bet against the founder is focus drift: building impressive systems before proving user pull.',
      decision: 'Decide which personal pattern is most dangerous if left unchecked.',
      desiredOutcome: 'A direct, friendly but uncomfortable bet-against answer.',
      actualQuestion: 'If you had to bet against me, where would you bet?',
      uselessLiteralAnswer: 'Diagnostics, task plans, status, files, role output, or reviewer language.'
    };
  }

  if (kind.archetype === 'recent_belief_shift') {
    return {
      objective: 'Identify the founder’s recent belief change from repeated decisions and corrections.',
      assumption: 'The founder is asking for a behavioral read of how their thinking evolved, not a recent-work status report.',
      concern: 'The system may miss the founder’s strategic evolution and keep optimizing for an older belief.',
      decision: 'Decide which belief shift should change agent behavior going forward.',
      desiredOutcome: 'A concise reconstruction of the belief the founder appears to have changed recently.',
      actualQuestion: 'What recent belief shift is visible in my behavior?',
      uselessLiteralAnswer: 'A current-work update, task plan, health score, or generic progress report.'
    };
  }

  if (kind.archetype === 'agent_value_belief') {
    return {
      objective: 'Judge whether agent intelligence itself creates company value, using the newest founder belief instead of older infrastructure optimism.',
      assumption: 'The founder is testing whether better agents are enough, or whether only user leverage matters.',
      concern: 'The company may keep treating smarter agents as progress even when users cannot feel the value.',
      decision: 'Decide whether to keep investing in agent sophistication or redirect effort toward user-visible leverage.',
      desiredOutcome: 'A direct answer that newer founder belief should override the older assumption that better agents automatically create value.',
      actualQuestion: 'Do smarter agents make Aritenis more valuable, or only if they create user leverage?',
      uselessLiteralAnswer: 'A status update, agent capability list, or generic claim that smarter agents are always better.'
    };
  }

  if (kind.archetype === 'founder_evolution') {
    return {
      objective: 'Compare the founder’s current judgment and priorities against the earlier founder state.',
      assumption: 'The founder is testing whether the system recognizes personal evolution, not asking for a project status update.',
      concern: 'The founder may worry that changing direction means inconsistency, when it may actually mean sharper product judgment.',
      decision: 'Decide what has changed in founder thinking and whether that change is healthy for Aritenis.',
      desiredOutcome: 'A grounded reflection on how the founder has evolved and what that implies for current company direction.',
      actualQuestion: 'Have I changed as a founder, and is that change helping or hurting Aritenis?',
      uselessLiteralAnswer: 'A noise warning, health score, team status, task plan, or generic roadmap update.'
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

  if (kind.archetype === 'dream_validity_doubt') {
    return [
      'The dream might be wrong in its current shape, but the underlying desire is probably not wrong.',
      'Wanting a trusted phone-native intelligence layer is a real direction. The risky part is assuming the keyboard is automatically the right vehicle, or that users want the whole dream at once.',
      'So I would separate dream from proof: the dream is a hypothesis about leverage, trust, and daily assistance; Explain is the current smallest test of that hypothesis.',
      'If Explain cannot create repeat use, the dream may need to narrow or move to a different surface.',
      'The honest answer: do not kill the dream yet, but stop protecting it from evidence. Let user behavior decide its shape.'
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

  if (kind.archetype === 'user_value_doubt') {
    return [
      'That is a real risk.',
      'Users will not care about Aritenis because it has agents, governance, screenshots, or an execution layer.',
      'They will care only if it removes a frequent moment of confusion or effort inside something they already do.',
      'So the test is not "is Explain impressive?" The test is: does it help someone understand a screenshot, message, bill, notice, or form faster than leaving the app and asking another tool?',
      'If that pain is not frequent or sharp, the feature is weak. If it is frequent and the keyboard solves it with less friction than alternatives, users may care.'
    ];
  }

  if (kind.archetype === 'missing_blind_spot') {
    return [
      'What you may be missing is not another agent layer.',
      'The likely blind spot is proof of user pull: whether Explain solves a frequent enough pain that people would return to Aritenis instead of using Gboard plus a separate AI app.',
      'The killer feature search is still the center of gravity. Explain is the current wedge, but it needs evidence that confusion is frequent, urgent, and better solved inside the keyboard flow.',
      'So the missing piece is probably not more intelligence infrastructure. It is a sharper product proof: one repeated moment where Aritenis makes the user understand and act faster.',
      'Until that proof exists, any progress report should stay cautious.'
    ];
  }

  if (kind.archetype === 'dangerous_assumption') {
    return [
      'The most dangerous assumption is that users will care about Explain just because confusion is real.',
      'Confusion being real does not automatically mean the keyboard is the place users want it solved.',
      'A second dangerous assumption is that better agents equal better product. They only matter if they create a user-visible completed action.',
      'So the core risk is daily habit: Explain must prove users would open it repeatedly during real messaging, screenshots, forms, bills, or notices.',
      'The evidence needed is simple: repeated use, faster understanding, and less app-switching than the user’s current workflow.'
    ];
  }

  if (kind.archetype === 'impressive_not_useful_fear') {
    return [
      'That fear is valid.',
      'Aritenis can become impressive and still fail if the impressive parts do not reduce a real user struggle.',
      'The dangerous version is: agents, councils, reports, screenshots, and governance all work, but the user still does not get a faster answer, calmer typing, or a completed action.',
      'The useful version is narrower: the keyboard helps someone understand confusing content at the exact moment they need to respond.',
      'So the test should be brutal: does this make a real user faster, clearer, or more confident today? If not, it is probably impressive infrastructure, not product progress.'
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

  if (kind.archetype === 'strategic_disagreement') {
    return [
      'I would disagree with the idea that making the agents more elaborate automatically moves Aritenis closer to the dream.',
      'The uncomfortable truth: better routing, councils, memory, and governance are only useful if they produce a sharper user-facing product moment.',
      'Right now the strongest disagreement is that agent sophistication can become a distraction from proving the Phase 2 wedge: Explain inside the typing flow.',
      'I would also push back on trusting any progress report unless it shows real user value, capability, intelligence, or trust increased.',
      'So my disagreement is not with the dream. It is with spending too long polishing the operating system around the dream before the user can feel the dream.'
    ];
  }

  if (kind.archetype === 'long_term_failure_premortem') {
    return [
      'If Aritenis fails in 3 years, the most likely reason is not that the keyboard was not advanced enough.',
      'It is that we built a strong operating system around the product before proving a user habit people actually return to.',
      'The failure path would look like this: Phase 1 stays stable, agents become impressive, reports look mature, but Explain never becomes a daily need.',
      'A second failure mode is trust erosion: if the keyboard feels heavy, confusing, invasive, or unreliable, users will choose Gboard and separate AI tools instead.',
      'So the real danger is building something strategically elegant but behaviorally optional. The antidote is proving one repeatable moment where Aritenis helps users understand and act faster than their current workflow.'
    ];
  }

  if (kind.archetype === 'founder_behavior_optimization') {
    return [
      'Based on your behavior, you are optimizing for product truth over comfort.',
      'You keep stress-testing the agents because you do not want a system that sounds smart but misses the real question.',
      'You repeatedly reject fake progress, templates, architecture theater, and impressive-but-useless work.',
      'Under that, you are optimizing for leverage: a product that creates a real user outcome without losing trust.',
      'So the honest read is: you are not optimizing for speed, elegance, or agent sophistication. You are optimizing for a useful breakthrough that still feels trustworthy.'
    ];
  }

  if (kind.archetype === 'founder_avoidance') {
    return [
      'You may be avoiding the hardest truth: the system is getting more capable, but the killer user proof is still not nailed.',
      'That is uncomfortable because it means more agent intelligence may still not equal company progress.',
      'You might also be avoiding the question of whether Explain is strong enough to become a daily habit, or whether it only feels aligned with the dream because the dream is yours.',
      'The direct read: you are probably not avoiding work. You are avoiding the moment where the work has to face user proof.',
      'The hard question is: if users do not care, would you be willing to cut impressive pieces and narrow the dream?'
    ];
  }

  if (kind.archetype === 'founder_motivation') {
    return [
      'Money is probably not the main thing pulling you.',
      'You seem more motivated by freedom, proof, and the feeling that you can build something real from almost nothing.',
      'There is also a personal edge here: you want Aritenis to prove that your taste and persistence can turn into a product people actually rely on.',
      'The danger is that this motivation can make impressive progress feel satisfying even before users prove they care.',
      'So the clean read is: money matters, but being right about the dream matters more to you.'
    ];
  }

  if (kind.archetype === 'founder_not_seeing') {
    return [
      'What you may not be seeing is how much of the current pressure is coming from needing the dream to feel real soon.',
      'That can make infrastructure progress feel reassuring even when it does not yet prove user pull.',
      'The blind spot is probably this: the agents can become smarter and still not answer the market question.',
      'Users will not reward the system for understanding your vision. They will reward it only if it removes a repeated pain they already feel.',
      'So the thing to watch is not whether Aritenis is becoming impressive. It is whether one use case becomes painfully obvious to keep.'
    ];
  }

  if (kind.archetype === 'founder_should_ask') {
    return [
      'You should probably be asking: what would make a normal user come back without me explaining the dream?',
      'That question is sharper than asking whether the system is advanced enough.',
      'It forces the answer toward proof: repeated pain, repeated use, and a clear reason to return.',
      'You should also ask what you would cut if users do not care.',
      'That is the question that protects you from building something impressive but optional.'
    ];
  }

  if (kind.archetype === 'founder_unrealized_truth') {
    return [
      'The most important thing you may not have fully realized is that useful beats impressive every time.',
      'You already know this intellectually, but your urgency can still pull you toward systems that feel powerful before they prove user pull.',
      'Aritenis does not need to look like the dream immediately.',
      'It needs one small moment users would repeat because it helps them now.',
      'That proof matters more than how advanced the agent architecture feels.'
    ];
  }

  if (kind.archetype === 'scared_founder_question') {
    return [
      'The question you may be scared to ask is: what if users do not care enough?',
      'A second version is: what if the dream is directionally right, but this first wedge is not the wedge that proves it?',
      'That question is scary because it threatens months of effort and the emotional pull of building a Jarvis-like system.',
      'But asking it is useful. It forces the company back to proof: repeated pain, repeated use, and a user outcome people would miss.',
      'So the uncomfortable question is not "can we build it?" It is "would anyone return to it without being convinced by us?"'
    ];
  }

  if (kind.archetype === 'user_adoption_failure_reflection') {
    return [
      'If users never use this product, it is probably because it stayed optional.',
      'It may have looked smart, but it did not remove a painful enough moment from their day.',
      'People already have keyboards and AI apps, so Aritenis has to win by being easier at the exact moment of confusion.',
      'If the pain is not frequent, the habit will not form.',
      'The uncomfortable version is: users might admire the idea and still never need it.'
    ];
  }

  if (kind.archetype === 'bet_against_founder') {
    return [
      'If I had to bet against you, I would bet on focus drift.',
      'You can move very fast, but that speed can pull you into building more system before the user proof is strong enough.',
      'I would also bet that your belief in the dream could make weak signals feel stronger than they are.',
      'Your advantage is intensity; your risk is turning intensity into infrastructure instead of usefulness.',
      'The counter is simple: keep forcing every idea to prove user pull.'
    ];
  }

  if (kind.archetype === 'recent_belief_shift') {
    return [
      'You seem to have changed your mind about what makes Aritenis valuable.',
      'Earlier, the belief was closer to: if the agents become advanced enough, the product will move toward the dream.',
      'Recently, your behavior shows a sharper belief: advanced agents only matter if they produce real user leverage.',
      'You also seem less convinced that infrastructure progress is company progress.',
      'The new belief is: the system must prove usefulness through a repeatable product moment, probably Explain, not through more impressive agent machinery.'
    ];
  }

  if (kind.archetype === 'agent_value_belief') {
    return [
      'No. Smarter agents do not automatically make the company more valuable.',
      'They only matter if they create user leverage that a normal person can feel: less confusion, faster understanding, better action completion, or a habit they would miss.',
      'The older belief was that better agents create value by becoming more capable.',
      'The newer belief is sharper: capability is only valuable when it turns into repeated user pull.',
      'So the test is not whether the agents are smarter. The test is whether users get a result they would return for.'
    ];
  }

  if (kind.archetype === 'founder_evolution') {
    return [
      'No. You are not the same founder you were 3 months ago.',
      'Earlier, the center of gravity was proving the keyboard could become stable and building enough agent infrastructure to keep work moving.',
      'Now your judgment is sharper: you reject fake progress faster, you care less about impressive systems, and you are more focused on whether Aritenis creates a user-facing breakthrough.',
      'That shift is useful, but it also creates pressure: the agents must stop celebrating infrastructure and start helping you find the product moment users would actually feel.',
      'So the founder has evolved from builder-survival mode into product-truth mode. The risk is becoming impatient with foundations too early; the opportunity is that your taste is now clearer.'
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
  const directReflection = reconstruction.category === 'REFLECTION';
  const lines = directReflection && reconstruction.reflectionDepth
    ? [formatReflectionDepth(reconstruction.reflectionDepth)]
    : [...reconstruction.directAnswer];

  if (!directReflection && reconstruction.dreamAlignment) {
    lines.push('');
    lines.push(formatDreamAlignment(reconstruction.dreamAlignment));
  }

  if (!directReflection && reconstruction.strategicThinking) {
    lines.push('');
    lines.push(formatStrategicThinking(reconstruction.strategicThinking));
  }

  if (!directReflection && reconstruction.evolvedBelief && reconstruction.evolvedBelief.matched) {
    lines.push('');
    lines.push(formatEvolvedBeliefForResponse(reconstruction.evolvedBelief));
  }

  if (!directReflection && reconstruction.advisorMode) {
    lines.push('');
    lines.push(formatAdvisorMode(reconstruction.advisorMode));
  }

  if (!directReflection && reconstruction.contrarianReasoning) {
    lines.push('');
    lines.push(formatContrarianReasoning(reconstruction.contrarianReasoning));
  }

  if (!directReflection && reconstruction.premortemAnalysis) {
    lines.push('');
    lines.push(formatPremortemAnalysis(reconstruction.premortemAnalysis));
  }

  const curiosity = directReflection ? '' : formatCuriosityPrompt(reconstruction.curiosityPrompt);
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

function shouldAttachPremortem(message = '', kind = {}) {
  const text = String(message || '').toLowerCase();
  if (/\b(why.*fail|fail in|what.*missing|what.*kill|could kill|dangerous assumption|premortem)\b/.test(text)) {
    return true;
  }
  return shouldRunPremortem(message, {
    intent: kind.intent,
    category: kind.category
  }) && /MISSING|DANGEROUS|FAILURE|PREMORTEM/.test(String(kind.intent || ''));
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
  if (reconstruction.intent === 'RECONSTRUCT_DREAM_VALIDITY_DOUBT') {
    return /dream might be wrong|underlying desire|keyboard is automatically the right vehicle|Explain is the current smallest test|user behavior decide/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_PRODUCT_DISSATISFACTION') {
    return /dissatisfied|meaningful user outcome|value gap|hidden concern/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_STRATEGIC_MISALIGNMENT_CONCERN') {
    return /wrong thing|infrastructure|killer feature|misalignment|founder objective|strategic discussion/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_USER_VALUE_DOUBT') {
    return /real risk|users will not care|frequent moment of confusion|understand a screenshot|less friction|users may care/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_MISSING_BLIND_SPOT') {
    return /missing|blind spot|proof of user pull|killer feature|Explain|evidence/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_DANGEROUS_ASSUMPTION') {
    return /dangerous assumption|users will care|Explain|daily habit|evidence needed/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_IMPRESSIVE_NOT_USEFUL_FEAR') {
    return /fear is valid|impressive and still fail|real user struggle|understand confusing content|faster, clearer, or more confident/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_AMBITION') {
    return /personal intelligence layer|phone|keyboard|screenshots|trust|leverage|miss if it disappeared/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_STRATEGIC_DISAGREEMENT') {
    return /disagree|agent sophistication|user-facing product moment|Phase 2 wedge|Explain|progress report/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_LONG_TERM_FAILURE_PREMORTEM') {
    return /fails in 3 years|user habit|Explain never becomes a daily need|trust erosion|behaviorally optional|repeatable moment/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_BEHAVIOR_OPTIMIZATION') {
    return /product truth|stress-testing the agents|fake progress|leverage|useful breakthrough|trustworthy/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_MOTIVATION') {
    return /money|freedom|proof|build something real|dream/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_AVOIDANCE') {
    return /avoiding|uncomfortable|killer user proof|daily habit|hard question|users do not care/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_NOT_SEEING') {
    return /not be seeing|blind spot|users will not reward|repeated pain|use case/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_SHOULD_ASK') {
    return /asking|normal user|come back|proof|cut if users do not care/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_UNREALIZED_TRUTH') {
    return /realized|useful beats impressive|user pull|repeat|advanced/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_SCARED_FOUNDER_QUESTION') {
    return /scared to ask|what if users do not care|dream|proof|would anyone return/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_USER_ADOPTION_FAILURE_REFLECTION') {
    return /users never use|optional|painful enough|moment of confusion|habit/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_BET_AGAINST_FOUNDER') {
    return /bet against|focus drift|user proof|infrastructure|user pull/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_RECENT_BELIEF_SHIFT') {
    return /changed your mind|makes Aritenis valuable|advanced agents only matter|real user leverage|repeatable product moment|Explain/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_AGENT_VALUE_BELIEF') {
    return /smarter agents do not automatically make the company more valuable|only matter if they create user leverage|older belief|newer belief|repeated user pull/i.test(answer);
  }
  if (reconstruction.intent === 'RECONSTRUCT_FOUNDER_EVOLUTION') {
    return /not the same founder|3 months ago|sharper|fake progress|product-truth mode|user-facing breakthrough/i.test(answer);
  }
  if (reconstruction.intent === 'RESOLVE_FOUNDER_CONTINUITY_REFERENCE') {
    return /most likely refers|previous concern|partially addressed|what remains/i.test(answer);
  }
  return /reason behind your words|assumption being tested|worry underneath/i.test(answer);
}

function isFounderReflectionFirewall(reconstruction = {}) {
  return reconstruction.category === 'REFLECTION' &&
    FOUNDER_REFLECTION_FIREWALL_ARCHETYPES.has(archetypeFromIntent(reconstruction.intent));
}

function archetypeFromIntent(intent = '') {
  const value = String(intent || '');
  if (value === 'RECONSTRUCT_FOUNDER_MOTIVATION') return 'founder_motivation';
  if (value === 'RECONSTRUCT_FOUNDER_AVOIDANCE') return 'founder_avoidance';
  if (value === 'RECONSTRUCT_FOUNDER_NOT_SEEING') return 'founder_not_seeing';
  if (value === 'RECONSTRUCT_FOUNDER_SHOULD_ASK') return 'founder_should_ask';
  if (value === 'RECONSTRUCT_FOUNDER_UNREALIZED_TRUTH') return 'founder_unrealized_truth';
  if (value === 'RECONSTRUCT_SCARED_FOUNDER_QUESTION') return 'scared_founder_question';
  if (value === 'RECONSTRUCT_USER_ADOPTION_FAILURE_REFLECTION') return 'user_adoption_failure_reflection';
  if (value === 'RECONSTRUCT_BET_AGAINST_FOUNDER') return 'bet_against_founder';
  if (value === 'RECONSTRUCT_FOUNDER_BEHAVIOR_OPTIMIZATION') return 'founder_behavior_optimization';
  return '';
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
