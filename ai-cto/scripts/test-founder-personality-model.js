const assert = require('assert');

const {
  FOUNDER_PERSONALITY_MODEL,
  predictFounderReaction,
  formatFounderReactionPrediction
} = require('../founder-personality-model');
const { buildVisionStewardMessage } = require('../whatsapp/vision-steward');

assert(FOUNDER_PERSONALITY_MODEL.rejects.includes('bureaucracy'));
assert(FOUNDER_PERSONALITY_MODEL.preferences.includes('product reality over architecture explanation'));

const bureaucracy = predictFounderReaction({
  proposal: 'Generate a governance dashboard and architecture modernization report.',
  evidence: '',
  expectedUserOutcome: ''
});
assert.strictEqual(bureaucracy.verdict, 'LIKELY_REJECT');
assert(
  bureaucracy.likelyRejections.some((reason) =>
    /fake progress|architecture theatre/i.test(reason)
  )
);

const explain = predictFounderReaction({
  proposal: 'Define a simple screenshot Explain flow with ready, confirm, and cancel.',
  evidence: 'Product Lab screenshot artifact is clean and verified.',
  interfaceShape: 'one-tap action surface inside the keyboard flow',
  expectedUserOutcome: 'users understand confusing content before they type'
});
assert.notStrictEqual(explain.verdict, 'LIKELY_REJECT');
assert(explain.likelyApprovals.some((reason) => /Phase 2 leverage|product reality|simple/i.test(reason)));

const emotionalCompanion = predictFounderReaction({
  proposal: 'Build an emotional AI companion personality that stores raw screenshots forever.'
});
assert.strictEqual(emotionalCompanion.verdict, 'LIKELY_REJECT');
assert(emotionalCompanion.likelyRejections.some((reason) => /privacy|trust/i.test(reason)));

const formatted = formatFounderReactionPrediction(explain);
assert(formatted.includes('Founder reaction prediction:'));
assert(!formatted.toLowerCase().includes('imitate'));

const visionMessage = buildVisionStewardMessage({
  engineeringState: {
    sections: {
      risks: ['Product Lab screenshot evidence is weak.'],
      unresolved: [],
      approvals: []
    }
  },
  roadmap: {
    northStar: 'help users understand confusing content before they type.',
    currentPhase: 'Phase 2 Explain active'
  }
});
assert(visionMessage.includes('Founder reaction prediction:'));
assert(visionMessage.includes('Suggested improvement:'));
assert(!visionMessage.includes('Starting execution'));

console.log('Founder personality model checks passed');
