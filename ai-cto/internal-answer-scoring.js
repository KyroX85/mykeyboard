const MIN_ACCEPTABLE_TOTAL = 38;
const MAX_QUALITY_HISTORY = 80;
const MAX_BEST_EXAMPLES = 12;

function scoreInternalAnswer({
  message = '',
  response = '',
  route = {},
  memory = {}
} = {}) {
  const cleanMessage = normalize(message);
  const cleanResponse = stripEnvelope(response);
  const scores = {
    specificity: scoreSpecificity(cleanMessage, cleanResponse),
    founderRelevance: scoreFounderRelevance(cleanMessage, cleanResponse, route, memory),
    truthfulness: scoreTruthfulness(cleanResponse),
    usefulness: scoreUsefulness(cleanMessage, cleanResponse, memory),
    strategicDepth: scoreStrategicDepth(cleanResponse),
    templateContamination: scoreTemplateCleanliness(cleanResponse)
  };
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return {
    version: '1.0',
    scores,
    total,
    threshold: MIN_ACCEPTABLE_TOTAL,
    shouldRegenerate: total < MIN_ACCEPTABLE_TOTAL,
    reason: total < MIN_ACCEPTABLE_TOTAL
      ? 'Answer quality below founder-facing threshold.'
      : 'Answer quality meets founder-facing threshold.'
  };
}

function enforceInternalAnswerQuality(route = {}, {
  message = '',
  memory = {}
} = {}) {
  if (!route || typeof route.response !== 'string') return route;
  if (route.details && route.details.suppressSelfCritique) return route;
  if (!shouldScoreRoute(route)) return route;

  const initial = scoreInternalAnswer({
    message,
    response: route.response,
    route,
    memory
  });
  if (!initial.shouldRegenerate) {
    return attachScoring(route, initial, false);
  }

  const regeneratedResponse = regenerateAnswer({
    message,
    response: route.response,
    route,
    memory,
    initial
  });
  const rescored = scoreInternalAnswer({
    message,
    response: regeneratedResponse,
    route,
    memory
  });
  return attachScoring({
    ...route,
    response: regeneratedResponse,
    matchedRoute: route.matchedRoute || 'internal_answer_scoring'
  }, rescored, true, initial);
}

function shouldScoreRoute(route = {}) {
  const command = String(route.command || '');
  const matchedRoute = String(route.matchedRoute || '');
  const intent = route.details && route.details.intent ? String(route.details.intent) : '';
  const agent = route.details && route.details.agent ? String(route.details.agent) : '';
  if (agent && agent !== 'cto') return false;
  if (command === 'agent' && intent !== 'bad_route') return false;
  if (matchedRoute === 'greeting_first') return false;
  if (/^(check_in|summary|status|direction|praise|recent_fix_question)$/i.test(intent)) return false;
  if (/\bAUDITOR\b/.test(String(route.response || ''))) return false;
  if (/(build|scan|screenshot|execution|approval|commit|push|product_lab|preservation)/i.test(command)) {
    return false;
  }
  if (/^(founder_feedback_recorded|status|health|momentum|risks|keyboard_health|cto_summary|weekly_summary|fix_limit|execution_status|execution_history|latest_fixes|pending_issues|approvals|next_priorities|memory|focus|low_information|noise_signal_ignored|hot_path_rewrite_blocked|anti_vanity_block|preservation_mode_blocked|preservation_mode_enabled|preservation_mode_disabled)$/i.test(command)) {
    return false;
  }
  return /^(founder_mind_reconstruction|conversational_fallback|agent|anti_template_conversation_guard)$/i.test(command);
}

function attachScoring(route = {}, scoring = {}, regenerated = false, originalScoring = null) {
  return {
    ...route,
    details: {
      ...(route.details || {}),
      internalAnswerScoring: {
        scores: scoring.scores,
        total: scoring.total,
        threshold: scoring.threshold,
        regenerated,
        originalTotal: originalScoring ? originalScoring.total : scoring.total,
        reason: scoring.reason
      }
    }
  };
}

function regenerateAnswer({
  message = '',
  memory = {}
} = {}) {
  const intent = inferFounderIntent(message);
  const memoryHint = bestMemoryHint(memory);
  const exampleHint = bestAnswerExampleHint(message, memory);
  if (intent === 'dream_alignment') {
    return [
      'Partially. The direction is closer when we build user-facing leverage, not when we only improve infrastructure.',
      'The dream is an intelligence layer people trust daily. The current useful path is proving that Explain or a similar wedge helps users understand something before they type.',
      exampleHint,
      memoryHint,
      'The honest gap: we still need repeated user-value evidence, not more status reports.'
    ].filter(Boolean).join('\n');
  }
  if (intent === 'founder_reflection') {
    return [
      'You are testing the reason behind your words, not asking for a status update.',
      'The assumption being tested is whether the agents can infer your concern before routing into tasks.',
      'The worry underneath is that the system may still be answering keywords instead of understanding the founder.',
      exampleHint,
      'The actual question is: can the agents think with you before they execute?'
    ].filter(Boolean).join('\n');
  }
  if (intent === 'awareness_check') {
    return [
      'You are probably testing whether the agents are context-aware, not asking for a generic health report.',
      'A useful answer should explain what is actually happening in the conversation and what the system is aware of.',
      exampleHint,
      'The risk is falling back into status-template language instead of showing real awareness.'
    ].filter(Boolean).join('\n');
  }
  if (intent === 'continuity_check') {
    return [
      'That refers to the previous concern.',
      'It is partially addressed if the agents now route doubt and strategy questions into conversation instead of execution.',
      'What remains is proving the behavior across real WhatsApp use, not only scripted tests.'
    ].join('\n');
  }
  if (intent === 'user_value_doubt') {
    return [
      'You are testing whether the idea creates real user pull.',
      'The useful answer is not a status update: users care only if this removes a repeated pain, saves effort, or makes a confusing moment easier.',
      exampleHint,
      memoryHint,
      'Next judgment should be based on observable user value, not how impressive the system sounds.'
    ].filter(Boolean).join('\n');
  }
  if (intent === 'missing_blind_spot') {
    return [
      'The likely missing piece is proof of repeated user need.',
      'Aritenis has strong direction, but the answer should keep asking: would a normal user notice, care, return, and trust this enough to keep it installed?',
      exampleHint,
      memoryHint
    ].filter(Boolean).join('\n');
  }
  return [
    'CTO: The previous response was too low-signal for the question.',
    'A better answer should address the founder objective directly, then connect it to user value, product truth, and the current Aritenis direction.',
    exampleHint,
    memoryHint || 'I should avoid health, momentum, or task-plan framing unless you explicitly ask for sourced status.'
  ].join('\n');
}

function scoreSpecificity(message = '', response = '') {
  if (!response) return 1;
  let score = 2;
  if (/\bExplain\b|\bscreenshot\b|\buser-facing\b|\brepeated\b|\bproof\b|\bkeyboard\b|\bAritenis\b/i.test(response)) score += 3;
  if (/\bthe gap\b|\bhonest gap\b|\bactual question\b|\bassumption\b|\bconcern\b/i.test(response)) score += 2;
  if (tokenOverlap(message, response) >= 0.2) score += 2;
  if (containsRejectedStatus(response)) score -= 3;
  if (/Current Foundation Health|Recommended Next Step|Highest Leverage Differentiator/i.test(response)) score -= 3;
  return clamp(score, 1, 10);
}

function scoreFounderRelevance(message = '', response = '', route = {}, memory = {}) {
  if (!response) return 1;
  if (containsRejectedStatus(response) && !isStatusQuestion(message)) return 2;
  const overlap = tokenOverlap(message, response);
  const routeBonus = route.command === 'founder_mind_reconstruction' ? 2 : 0;
  const directAnswerBonus = /partially|yes|no|probably|likely|because|the answer/i.test(response) ? 2 : 0;
  const dreamBonus = /\bdream|vision|chasing|moving toward\b/i.test(message) &&
    /\bdream|intelligence layer|user-facing|Explain|leverage\b/i.test(response)
    ? 2
    : 0;
  const feedbackBonus = memory && memory.founderFeedback && memory.founderFeedback.length ? 1 : 0;
  return clamp(2 + Math.round(overlap * 5) + routeBonus + directAnswerBonus + dreamBonus + feedbackBonus, 1, 10);
}

function scoreTruthfulness(response = '') {
  if (!response) return 1;
  let score = 7;
  if (/\bdefinitely\b|\bguaranteed\b|\b100%|\bwill succeed\b|\busers will\b/i.test(response)) score -= 3;
  if (/\bunproven\b|\bevidence\b|\bproof\b|\bhonest gap\b|\bpartially\b|\bnot proved\b|\bnot proven\b|\bmissing\b/i.test(response)) score += 2;
  if (containsRejectedStatus(response)) score -= 4;
  return clamp(score, 1, 10);
}

function scoreUsefulness(message = '', response = '', memory = {}) {
  if (!response) return 1;
  let score = 2;
  if (/\buser\b|\bvalue\b|\bpain\b|\bhabit\b|\btrust\b|\breturn\b|\buseful\b|\bproof\b/i.test(response)) score += 3;
  if (/\bwhat this means\b|\bthe useful answer\b|\bnext judgment\b|\bthe honest gap\b|\bactual question\b/i.test(response)) score += 2;
  if (selectHighScoringAnswerExamples(message, memory).length) score += 1;
  if (containsRejectedStatus(response) && !isStatusQuestion(message)) score -= 3;
  return clamp(score, 1, 10);
}

function scoreStrategicDepth(response = '') {
  if (!response) return 1;
  let score = 2;
  if (/\bbecause\b|\bmeans\b|\bif\b|\btherefore\b|\bthe gap\b|\btradeoff\b/i.test(response)) score += 3;
  if (/\buser\b|\bvalue\b|\btrust\b|\bevidence\b|\bretention\b|\bdream\b|\bstrategy\b/i.test(response)) score += 3;
  if (/\breason behind\b|\bassumption being tested\b|\bworry underneath\b|\bhidden concern\b|\bdesired outcome\b/i.test(response)) score += 4;
  if (/Strongest case for:|Strongest case against:|Likely reality:/i.test(response)) score += 3;
  if (response.split(/\s+/).length >= 24) score += 1;
  if (containsRejectedStatus(response)) score -= 3;
  return clamp(score, 1, 10);
}

function scoreTemplateCleanliness(response = '') {
  if (!response) return 1;
  let score = 10;
  if (containsRejectedStatus(response)) score -= 8;
  if (/current foundation health|highest leverage differentiator|recommended next step|phase 2 opportunities|trust risk:/i.test(response)) score -= 4;
  if (/TASK_PLAN|APPROVE|Execution Plan|Files:|Validation:/i.test(response)) score -= 6;
  return clamp(score, 1, 10);
}

function updateAnswerQualityMemory(existing = {}, event = {}) {
  const current = normalizeAnswerQualityMemory(existing);
  if (!event || !event.scoring || !event.response) return current;
  const entry = {
    timestamp: new Date().toISOString(),
    messagePattern: normalize(event.message).slice(0, 240),
    routeKey: routeKeyFor(event.route),
    responsePreview: preview(event.response, 360),
    scores: event.scoring.scores || {},
    total: Number(event.scoring.total || 0),
    regenerated: Boolean(event.scoring.regenerated),
    templateContamination: event.scoring.scores ? event.scoring.scores.templateContamination : null
  };
  const history = [entry, ...current.history].slice(0, MAX_QUALITY_HISTORY);
  const bestExamples = history
    .filter((item) => item.total >= MIN_ACCEPTABLE_TOTAL)
    .sort((a, b) => b.total - a.total || Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_BEST_EXAMPLES);
  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    history,
    bestExamples,
    lastScore: entry
  };
}

function normalizeAnswerQualityMemory(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: '1.0',
    lastUpdatedAt: source.lastUpdatedAt || null,
    history: Array.isArray(source.history) ? source.history.filter(Boolean).slice(0, MAX_QUALITY_HISTORY) : [],
    bestExamples: Array.isArray(source.bestExamples) ? source.bestExamples.filter(Boolean).slice(0, MAX_BEST_EXAMPLES) : [],
    lastScore: source.lastScore || null
  };
}

function selectHighScoringAnswerExamples(message = '', memory = {}) {
  const examples = memory && memory.answerQualityMemory && Array.isArray(memory.answerQualityMemory.bestExamples)
    ? memory.answerQualityMemory.bestExamples
    : [];
  const normalized = normalize(message);
  return examples
    .map((item) => ({
      ...item,
      relevance: Math.max(tokenOverlap(normalized, item.messagePattern || ''), tokenOverlap(normalized, item.responsePreview || ''))
    }))
    .filter((item) => item.relevance >= 0.12 || Number(item.total || 0) >= MIN_ACCEPTABLE_TOTAL + 8)
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return Number(b.total || 0) - Number(a.total || 0);
    })
    .slice(0, 3);
}

function bestAnswerExampleHint(message = '', memory = {}) {
  const example = selectHighScoringAnswerExamples(message, memory)[0];
  if (!example) return '';
  return `Previous high-quality answer pattern: ${example.responsePreview}`;
}

function inferFounderIntent(message = '') {
  const text = String(message || '').toLowerCase();
  if (/\bdream\b|\bmoving toward\b|\bfinal goal\b|\bchasing\b/.test(text)) return 'dream_alignment';
  if (/\bwhy am i asking\b|\bwhat assumption am i testing\b|\bwhat am i testing\b|\bwhat am i worried about\b|\bwhy did i ask\b/.test(text)) return 'founder_reflection';
  if (/^what'?s happening\??$|^what is happening\??$/i.test(String(message || '').trim())) return 'awareness_check';
  if (/\bdid we fix that\b|\bis that fixed\b|\bwhat about that\b/i.test(text)) return 'continuity_check';
  if (/\busers?\b.*\bcare\b|\buseful\b|\bimpressive instead of useful\b/.test(text)) return 'user_value_doubt';
  if (/\bmissing\b|\bblind spot\b|\bwhat am i not seeing\b/.test(text)) return 'missing_blind_spot';
  return 'general_founder_question';
}

function bestMemoryHint(memory = {}) {
  const feedback = Array.isArray(memory.founderFeedback) ? memory.founderFeedback : [];
  if (feedback.some((item) => item && item.polarity === 'negative' && /cto|generic|status/i.test(`${item.feedback} ${item.adaptation} ${item.answerPattern}`))) {
    return 'Founder feedback says to avoid generic CTO/status framing here.';
  }
  return '';
}

function routeKeyFor(route = {}) {
  if (!route) return 'unknown';
  if (route.command) return String(route.command);
  if (route.details && route.details.intent) return String(route.details.intent);
  return 'unknown';
}

function stripEnvelope(value = '') {
  return String(value || '')
    .replace(/^Memory Sources Used:[^\n]*\n?/i, '')
    .replace(/^type:\s*(AUDIT_REPORT|TASK_PLAN|EXECUTION_RESULT|CLARIFICATION_REQUEST)\s*\n?/i, '')
    .replace(/^intent:\s*[a-z_]+\s*\n?/i, '')
    .trim();
}

function preview(value = '', limit = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit) || null;
}

function containsRejectedStatus(response = '') {
  return /\bHealth\s*:?\s*\d{1,3}|\bMomentum\b|Team is ready|Current Foundation Health|Recommended Next Step|Task Plan/i.test(String(response || ''));
}

function isStatusQuestion(message = '') {
  return /^(status|health|momentum)$/i.test(String(message || '').trim()) ||
    /\bstatus update|health score|momentum score\b/i.test(String(message || ''));
}

function tokenOverlap(left = '', right = '') {
  const leftTokens = importantTokens(left);
  const rightTokens = importantTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter((token) => rightSet.has(token)).length;
  return shared / Math.max(leftTokens.length, rightTokens.length);
}

function importantTokens(value = '') {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 3)
    .filter((token) => !STOP_WORDS.has(token));
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}

const STOP_WORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'about',
  'this',
  'that',
  'with',
  'from',
  'your',
  'youre',
  'founder',
  'answer',
  'question',
  'would',
  'should',
  'could',
  'have',
  'were',
  'been',
  'they',
  'them'
]);

module.exports = {
  scoreInternalAnswer,
  enforceInternalAnswerQuality,
  updateAnswerQualityMemory,
  normalizeAnswerQualityMemory,
  selectHighScoringAnswerExamples,
  regenerateAnswer,
  MIN_ACCEPTABLE_TOTAL
};
