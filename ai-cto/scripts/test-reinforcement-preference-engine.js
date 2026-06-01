const assert = require('assert');

const {
  buildReinforcementPreferences,
  updateReinforcementPreferenceMemory,
  applyReinforcementPreferencesToRoute
} = require('../reinforcement-preference-engine');

const feedbackMemory = {
  founderFeedback: [
    {
      feedback: 'too_much_cto_mode',
      polarity: 'negative',
      confidence: 86,
      adaptation: 'stay_conversational',
      answerPattern: 'current foundation health momentum stalled task plan'
    },
    {
      feedback: 'too_generic',
      polarity: 'negative',
      confidence: 86,
      adaptation: 'add_specific_product_test',
      answerPattern: 'health report recommended next step generic'
    },
    {
      feedback: 'good_answer',
      polarity: 'positive',
      confidence: 88,
      adaptation: 'preserve_direct_reasoning',
      answerPattern: 'direct reflection strategy product truth user value'
    }
  ],
  reinforcementEvents: [
    {
      reward: 2,
      routeKey: 'founder_mind_reconstruction',
      answerPattern: 'reflection strategy user value'
    },
    {
      reward: -2,
      routeKey: 'status',
      answerPattern: 'health momentum status'
    }
  ]
};

const preferences = buildReinforcementPreferences(feedbackMemory);

assert(preferences.weights.reflection > 0);
assert(preferences.weights.strategy > 0);
assert(preferences.weights.product_truth > 0);
assert(preferences.weights.user_value > 0);
assert(preferences.weights.health_report < 0);
assert(preferences.weights.momentum_report < 0);
assert(preferences.weights.task_plan < 0);
assert(preferences.weights.cto_report < 0);
assert(preferences.confidence <= 90);
assert(preferences.evidence.positive.length >= 1);
assert(preferences.evidence.negative.length >= 1);

const stored = updateReinforcementPreferenceMemory(null, preferences);
assert.strictEqual(stored.lastPreferences.weights.health_report, preferences.weights.health_report);
assert(stored.history.length === 1);

const route = {
  command: 'founder_mind_reconstruction',
  details: { skipExecutionSchema: true },
  response: [
    'Current Foundation Health: protected.',
    'Momentum: stalled.',
    'Task Plan: continue.',
    'Users likely care only if Explain reduces confusion.'
  ].join('\n')
};

const adapted = applyReinforcementPreferencesToRoute(route, {
  reinforcementPreferenceMemory: stored
});

assert.doesNotMatch(adapted.response, /Current Foundation Health|Momentum|Task Plan/i);
assert.match(adapted.response, /Users likely care/i);
assert.strictEqual(adapted.details.reinforcementPreferencesApplied, true);
assert(adapted.details.reinforcementPreferences.avoid.includes('health_report'));
assert(adapted.details.reinforcementPreferences.prefer.includes('reflection'));

console.log('Reinforcement preference engine checks passed.');
