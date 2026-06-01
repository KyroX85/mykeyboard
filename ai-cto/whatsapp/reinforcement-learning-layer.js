const MAX_REINFORCEMENT_EVENTS = 80;
const MAX_ROUTE_EXAMPLES = 6;

const POSITIVE_REWARDS = [
  {
    label: 'founder_correct',
    pattern: /\b(correct|right|exactly|good answer|good|useful|accepted|yes this)\b/i,
    value: 2
  },
  {
    label: 'founder_continued_discussion',
    pattern: /\b(why|what|how|so|then|but|because|means|next|does that)\b/i,
    value: 0.25
  }
];

const NEGATIVE_REWARDS = [
  {
    label: 'founder_fix_request',
    pattern: /^(fix|retry)$/i,
    value: -2
  },
  {
    label: 'founder_wrong',
    pattern: /\b(wrong|incorrect|bad route|bad answer)\b/i,
    value: -2
  },
  {
    label: 'founder_not_relevant',
    pattern: /\b(not relevant|irrelevant|not what i asked|you didn'?t answer|did not answer)\b/i,
    value: -2
  },
  {
    label: 'founder_generic',
    pattern: /\b(generic|too generic|vague|too vague)\b/i,
    value: -1.5
  }
];

const NON_REWARDABLE_COMMANDS = new Set([
  'founder_feedback_recorded',
  'acknowledgement',
  'low_information',
  'noise_signal_ignored',
  'twilio_sandbox_join'
]);

function updateRouteReinforcement(memory = {}, command = '', details = {}) {
  const route = buildRouteDescriptor(command, details);
  const feedbackReward = rewardFromDetails(details);
  const textReward = rewardFromMessage(details.founderMessage);
  const reward = feedbackReward || textReward || continuedDiscussionReward(memory, route, details);
  const priorTarget = memory.lastRouteForReward || null;
  let nextScores = normalizeRouteScores(memory.routeScores);
  let event = null;

  if (reward && priorTarget && priorTarget.key && priorTarget.key !== route.key) {
    const updated = applyReward(nextScores[priorTarget.key], reward, details);
    nextScores = {
      ...nextScores,
      [priorTarget.key]: updated
    };
    event = {
      timestamp: new Date().toISOString(),
      routeKey: priorTarget.key,
      routeCommand: priorTarget.command || null,
      matchedRoute: priorTarget.matchedRoute || null,
      reward: reward.value,
      rewardLabel: reward.label,
      founderMessage: preview(details.founderMessage),
      answerPattern: preview(priorTarget.responsePattern),
      scoreAfter: updated.score
    };
  }

  return {
    routeScores: nextScores,
    reinforcementEvents: event
      ? [event, ...array(memory.reinforcementEvents)].slice(0, MAX_REINFORCEMENT_EVENTS)
      : array(memory.reinforcementEvents).slice(0, MAX_REINFORCEMENT_EVENTS),
    lastRouteForReward: isRewardableRoute(route) ? route : priorTarget || null,
    lastReward: event || memory.lastReward || null
  };
}

function applyReinforcementToRoute(route = {}, memory = {}) {
  const key = routeKeyFor(route.command, route.details || route);
  const score = normalizeRouteScores(memory.routeScores)[key] || null;
  if (!score) return route;
  return {
    ...route,
    details: {
      ...(route.details || {}),
      routeReinforcement: {
        key,
        score: score.score,
        confidence: score.confidence,
        positive: score.positive,
        negative: score.negative
      }
    }
  };
}

function rankRoutesWithReinforcement(memory = {}, routeKeys = []) {
  const scores = normalizeRouteScores(memory.routeScores);
  return routeKeys
    .map((key) => ({
      key,
      score: scores[key] ? scores[key].score : 0,
      confidence: scores[key] ? scores[key].confidence : 0
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.confidence - a.confidence;
    });
}

function shouldPreferReinforcedConversation(message = '', memory = {}) {
  const normalized = String(message || '').toLowerCase().trim();
  if (!normalized || isExplicitExecution(normalized)) return false;
  if (!/\b(bro|think|feel|why|what|how|dream|wrong|off|satisfied|users|care)\b/i.test(normalized)) {
    return false;
  }
  const ranked = rankRoutesWithReinforcement(memory, [
    'founder_mind_reconstruction',
    'agent',
    'conversational_fallback',
    'vision_command_approval_required'
  ]);
  const top = ranked[0];
  return Boolean(top && top.key === 'founder_mind_reconstruction' && top.score > 0.5);
}

function rewardFromDetails(details = {}) {
  if (!details || details.intent !== 'founder_feedback') return null;
  if (details.polarity === 'positive') {
    return { label: `feedback_${details.feedback || 'positive'}`, value: 2 };
  }
  if (details.polarity === 'negative') {
    const value = details.feedback === 'too_generic' ? -1.5 : -2;
    return { label: `feedback_${details.feedback || 'negative'}`, value };
  }
  return null;
}

function rewardFromMessage(message = '') {
  const text = String(message || '').trim();
  if (!text) return null;
  const negative = NEGATIVE_REWARDS.find((item) => item.pattern.test(text));
  if (negative) return { label: negative.label, value: negative.value };
  const positive = POSITIVE_REWARDS.find((item) => item.pattern.test(text));
  if (!positive || positive.label === 'founder_continued_discussion') return null;
  return { label: positive.label, value: positive.value };
}

function continuedDiscussionReward(memory = {}, route = {}, details = {}) {
  const previous = memory.lastRouteForReward;
  if (!previous || !previous.key || previous.key === route.key) return null;
  if (NON_REWARDABLE_COMMANDS.has(route.command)) return null;
  const message = String(details.founderMessage || '').trim();
  if (!message || isExplicitExecution(message)) return null;
  const marker = POSITIVE_REWARDS.find((item) => item.label === 'founder_continued_discussion');
  if (!marker.pattern.test(message)) return null;
  return { label: marker.label, value: marker.value };
}

function applyReward(existing = null, reward = {}, details = {}) {
  const current = existing || {
    score: 0,
    positive: 0,
    negative: 0,
    confidence: 0,
    examples: []
  };
  const nextScore = clamp(Number(current.score || 0) + reward.value, -10, 10);
  const positive = reward.value > 0 ? Number(current.positive || 0) + 1 : Number(current.positive || 0);
  const negative = reward.value < 0 ? Number(current.negative || 0) + 1 : Number(current.negative || 0);
  const total = positive + negative;
  return {
    score: Number(nextScore.toFixed(2)),
    positive,
    negative,
    confidence: Number(Math.min(0.95, 0.35 + total * 0.08).toFixed(2)),
    lastUpdatedAt: new Date().toISOString(),
    examples: [
      {
        timestamp: new Date().toISOString(),
        reward: reward.value,
        rewardLabel: reward.label,
        founderMessage: preview(details.founderMessage)
      },
      ...array(current.examples)
    ].slice(0, MAX_ROUTE_EXAMPLES)
  };
}

function buildRouteDescriptor(command = '', details = {}) {
  const key = routeKeyFor(command, details);
  return {
    key,
    command,
    matchedRoute: details.matchedRoute || details.conversationRoute || null,
    intent: details.intent || null,
    category: details.category || null,
    responsePattern: details.agentAnswer || null,
    timestamp: new Date().toISOString()
  };
}

function routeKeyFor(command = '', details = {}) {
  if (command === 'founder_mind_reconstruction') return 'founder_mind_reconstruction';
  if (command === 'agent' && details.agent && details.intent) {
    return `agent:${details.agent}:${details.intent}`;
  }
  return String(command || details.intent || 'unknown');
}

function isRewardableRoute(route = {}) {
  if (!route || !route.command) return false;
  return !NON_REWARDABLE_COMMANDS.has(route.command);
}

function normalizeRouteScores(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isExplicitExecution(text = '') {
  return /\b(implement|execute|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|fix now)\b/i.test(String(text || ''));
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function preview(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 220) || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  updateRouteReinforcement,
  applyReinforcementToRoute,
  rankRoutesWithReinforcement,
  shouldPreferReinforcedConversation,
  routeKeyFor,
  rewardFromMessage,
  rewardFromDetails
};
