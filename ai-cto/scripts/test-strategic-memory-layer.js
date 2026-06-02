const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-strategic-memory-${Date.now()}.json`);

const {
  updateStrategicMemory,
  retrieveRelevantStrategicMemory,
  formatStrategicMemoryForResponse
} = require('../strategic-memory-layer');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');
const {
  enforceMemoryPolicyOnRoute
} = require('../memory-policy-enforcer');

const founderHypothesisTracker = {
  activeHypotheses: [
    {
      claim: 'Explain will become a daily habit when users face confusing content.',
      hypothesisClass: 'EXPLAIN_DAILY_HABIT',
      status: 'UNPROVEN',
      risks: ['Explain may be useful only occasionally, not daily.'],
      evidenceNeeded: ['Repeat usage evidence for Explain.'],
      confidence: 64
    },
    {
      claim: 'Users do not care about another impressive assistant.',
      hypothesisClass: 'GENERAL_FOUNDER_HYPOTHESIS',
      status: 'CONTRADICTED',
      currentEvidence: ['Founder rejected infrastructure-only value.'],
      confidence: 70
    },
    {
      claim: 'Typing foundation is protected enough for Phase 2 exploration.',
      hypothesisClass: 'GENERAL_FOUNDER_HYPOTHESIS',
      status: 'SUPPORTED',
      currentEvidence: ['Founder declared Phase 1 protected.'],
      confidence: 80
    }
  ]
};

const founderBeliefTracker = {
  beliefShifts: [
    {
      beforeBelief: 'advanced agents alone would move the company toward the dream',
      afterBelief: 'user leverage matters more than agent sophistication',
      changeReason: 'founder repeatedly rejected fake progress',
      confidence: 82
    }
  ]
};

const strategic = updateStrategicMemory(null, {
  founderMessage: 'I think Explain will become daily habit, but it is still unproven.',
  agentAnswer: 'The lesson is that Explain must prove repeat use before we call it the killer feature.',
  founderHypothesisTracker,
  founderBeliefTracker
});

assert(strategic.lessonsLearned.some((item) => /repeat use|killer feature|user leverage/i.test(item.summary)));
assert(strategic.failedHypotheses.some((item) => /Users do not care/i.test(item.summary)));
assert(strategic.successfulHypotheses.some((item) => /Typing foundation/i.test(item.summary)));
assert(strategic.founderBeliefChanges.some((item) => /user leverage matters/i.test(item.summary)));

const retrieval = retrieveRelevantStrategicMemory('What are we missing about Explain and daily habit?', strategic, { limit: 3 });
assert(retrieval.items.length > 0);
assert(retrieval.items[0].summary.match(/Explain|daily|repeat/i));
assert(formatStrategicMemoryForResponse(retrieval).includes('Strategic Memory Used:'));

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'I think Explain will become daily habit, but it is still unproven.',
  agentAnswer: 'The lesson is that Explain must prove repeat use before we call it the killer feature.',
  founderHypothesisTracker,
  founderBeliefTracker
});

const stored = readConversationMemory();
assert(stored.strategicMemory);
assert(stored.strategicMemory.lessonsLearned.length > 0);

const routed = enforceMemoryPolicyOnRoute({
  command: 'conversation',
  response: 'Explain is still a hypothesis, not proof.'
}, {
  message: 'What are we missing about Explain?',
  memory: stored
});
assert(routed.details.strategicMemoryRetrieval);
assert(routed.response.includes('Strategic Memory Used:'));
assert(routed.response.includes('strategic memory'));

console.log('Strategic memory layer checks passed.');
