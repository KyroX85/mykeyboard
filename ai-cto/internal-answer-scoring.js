const MIN_ACCEPTABLE_TOTAL = 25;

function scoreInternalAnswer({
  message = '',
  response = '',
  route = {},
  memory = {}
} = {}) {
  const cleanMessage = normalize(message);
  const cleanResponse = stripEnvelope(response);
  const scores = {
    relevance: scoreRelevance(cleanMessage, cleanResponse, route),
    insight: scoreInsight(cleanResponse),
    novelty: scoreNovelty(cleanResponse),
    founderAlignment: scoreFounderAlignment(cleanMessage, cleanResponse, memory)
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
  if (intent === 'dream_alignment') {
    return [
      'Partially. The direction is closer when we build user-facing leverage, not when we only improve infrastructure.',
      'The dream is an intelligence layer people trust daily. The current useful path is proving that Explain or a similar wedge helps users understand something before they type.',
      memoryHint,
      'The honest gap: we still need repeated user-value evidence, not more status reports.'
    ].filter(Boolean).join('\n');
  }
  if (intent === 'founder_reflection') {
    return [
      'You are testing the reason behind your words, not asking for a status update.',
      'The assumption being tested is whether the agents can infer your concern before routing into tasks.',
      'The worry underneath is that the system may still be answering keywords instead of understanding the founder.',
      'The actual question is: can the agents think with you before they execute?'
    ].join('\n');
  }
  if (intent === 'awareness_check') {
    return [
      'You are probably testing whether the agents are context-aware, not asking for a generic health report.',
      'A useful answer should explain what is actually happening in the conversation and what the system is aware of.',
      'The risk is falling back into status-template language instead of showing real awareness.'
    ].join('\n');
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
      memoryHint,
      'Next judgment should be based on observable user value, not how impressive the system sounds.'
    ].filter(Boolean).join('\n');
  }
  if (intent === 'missing_blind_spot') {
    return [
      'The likely missing piece is proof of repeated user need.',
      'Aritenis has strong direction, but the answer should keep asking: would a normal user notice, care, return, and trust this enough to keep it installed?',
      memoryHint
    ].filter(Boolean).join('\n');
  }
  return [
    'CTO: The previous response was too low-signal for the question.',
    'A better answer should address the founder objective directly, then connect it to user value, product truth, and the current Aritenis direction.',
    memoryHint || 'I should avoid health, momentum, or task-plan framing unless you explicitly ask for sourced status.'
  ].join('\n');
}

function scoreRelevance(message = '', response = '', route = {}) {
  if (!response) return 1;
  if (containsRejectedStatus(response) && !isStatusQuestion(message)) return 2;
  const overlap = tokenOverlap(message, response);
  const routeBonus = route.command === 'founder_mind_reconstruction' ? 2 : 0;
  const directAnswerBonus = /partially|yes|no|probably|likely|because|the answer/i.test(response) ? 2 : 0;
  return clamp(2 + Math.round(overlap * 5) + routeBonus + directAnswerBonus, 1, 10);
}

function scoreInsight(response = '') {
  if (!response) return 1;
  let score = 2;
  if (/\bbecause\b|\bmeans\b|\bif\b|\btherefore\b|\bthe gap\b|\btradeoff\b/i.test(response)) score += 3;
  if (/\buser\b|\bvalue\b|\btrust\b|\bevidence\b|\bretention\b|\bdream\b|\bstrategy\b/i.test(response)) score += 3;
  if (/\breason behind\b|\bassumption being tested\b|\bworry underneath\b|\bhidden concern\b|\bdesired outcome\b/i.test(response)) score += 4;
  if (response.split(/\s+/).length >= 24) score += 1;
  if (containsRejectedStatus(response)) score -= 3;
  return clamp(score, 1, 10);
}

function scoreNovelty(response = '') {
  if (!response) return 1;
  let score = 7;
  if (containsRejectedStatus(response)) score -= 5;
  if (/current foundation health|highest leverage differentiator|recommended next step/i.test(response)) score -= 3;
  if (/\bconcrete\b|\bhonest gap\b|\bobservable\b|\brepeated\b|\bproof\b/i.test(response)) score += 2;
  return clamp(score, 1, 10);
}

function scoreFounderAlignment(message = '', response = '', memory = {}) {
  let score = 2;
  const combined = `${message} ${response}`.toLowerCase();
  if (/\bwhy am i asking\b|\bwhat am i testing\b|\bwhy did i ask\b/.test(combined)) {
    score += /\breason behind\b|\bassumption being tested\b|\bworry underneath\b|\bactual question\b/i.test(response) ? 5 : 0;
  }
  if (/\bdream\b|\bvision\b|\bcompany\b|\bwhat am i chasing\b/.test(combined)) {
    score += /\bdream\b|\bvision\b|\bintelligence layer\b|\buser-facing leverage\b/.test(response.toLowerCase()) ? 4 : 0;
  }
  if (/\buser\b|\bvalue\b|\btrust\b|\buseful\b|\bevidence\b|\bproduct truth\b/.test(response.toLowerCase())) score += 3;
  if (memory && memory.founderFeedback && memory.founderFeedback.length) score += 1;
  if (containsRejectedStatus(response) && !isStatusQuestion(message)) score -= 4;
  return clamp(score, 1, 10);
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

function stripEnvelope(value = '') {
  return String(value || '')
    .replace(/^Memory Sources Used:[^\n]*\n?/i, '')
    .replace(/^type:\s*(AUDIT_REPORT|TASK_PLAN|EXECUTION_RESULT|CLARIFICATION_REQUEST)\s*\n?/i, '')
    .replace(/^intent:\s*[a-z_]+\s*\n?/i, '')
    .trim();
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
  regenerateAnswer,
  MIN_ACCEPTABLE_TOTAL
};
