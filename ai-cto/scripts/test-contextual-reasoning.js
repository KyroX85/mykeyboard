const assert = require('assert');
const {
  buildSemanticFounderState,
  resolveSemanticReference,
  rankProductPriorities,
  continuationPlan,
  rankUnresolvedTopics,
  detectSemanticConflicts,
  scoreContextConfidence,
  stabilizeSemanticMemory,
  buildOperationalIntelligence
} = require('../whatsapp/semantic-memory');
const { parseNaturalIntent } = require('../whatsapp/natural-intent-parser');
const { buildConversationMemory } = require('../whatsapp/conversational-memory');
const { routeMessage } = require('../whatsapp/command-router');

const state = {
  healthScore: 72,
  momentum: 'CAUTIOUS',
  validation: [
    { task: ':app:testDebugUnitTest', status: 'passed' },
    { task: ':app:assembleDebug', status: 'passed' }
  ],
  sections: {
    risks: ['Swipe long-word confidence still weak on architecture-like words.'],
    unresolved: ['Trail continuity clips during fast swipe bursts.'],
    repeatedFailures: ['Swipe trail regression repeated twice this week.'],
    completedFixes: ['Documentation wording cleanup completed.'],
    nextPriority: ['Measure swipe reliability before another cleanup pass.'],
    approvals: [],
    unstableFiles: [],
    safestOpportunity: ['Prepare a low-risk diagnostic plan for swipe trail sampling.']
  },
  changed: {
    completed: ['Documentation wording cleanup completed.'],
    newRisks: []
  },
  summary: {
    nextPriority: 'Measure swipe reliability before another cleanup pass.',
    topRisk: 'Swipe long-word confidence still weak.'
  }
};

const overengineeringState = {
  healthScore: 68,
  momentum: 'NOISY',
  validation: [],
  sections: {
    risks: ['New abstraction layer proposed with no typing latency evidence.'],
    unresolved: ['Symbol layout friction still unresolved on real-device typing.'],
    repeatedFailures: ['Report-only cleanup repeated this week.'],
    completedFixes: ['Generated another architecture report.'],
    nextPriority: ['Validate symbol pain and typing rhythm on device.'],
    approvals: [],
    unstableFiles: [],
    safestOpportunity: ['Collect real-device evidence before adding systems.']
  },
  changed: {
    completed: ['Generated another architecture report.'],
    newRisks: ['Complexity without UX improvement.']
  },
  summary: {
    nextPriority: 'Validate symbol pain and typing rhythm on device.',
    topRisk: 'Complexity without UX improvement.'
  }
};

const prior = {
  founderGoal: 'make keyboard feel premium',
  activeFocus: 'swipe reliability',
  unresolvedReference: 'swipe reliability',
  repeatedPainPoints: ['swipe reliability', 'too robotic', 'school mode'],
  preferredResponseStyle: 'mobile-first short worker updates',
  lastAgentInteraction: 'coder',
  lastActiveTask: 'swipe trail diagnostics'
};

const parsedFixThem = parseNaturalIntent('fix them', prior);
assert.strictEqual(parsedFixThem.matched, true);
assert.strictEqual(parsedFixThem.intent, 'current_work');
assert.strictEqual(parsedFixThem.continuity.referenceTerm, 'them');
assert.strictEqual(parsedFixThem.topic, 'swipe reliability');

const parsedContinue = parseNaturalIntent('continue after that', prior);
assert.strictEqual(parsedContinue.continuity.continuationRequested, true);
assert.strictEqual(parsedContinue.topic, 'swipe reliability');

const parsedStillBroken = parseNaturalIntent('still broken?', prior);
assert.strictEqual(parsedStillBroken.continuity.statusCheck, true);
assert.strictEqual(parsedStillBroken.topic, 'swipe reliability');

const parsedSameIssue = parseNaturalIntent('same issue?', prior);
assert.strictEqual(parsedSameIssue.continuity.statusCheck, true);
assert.strictEqual(parsedSameIssue.topic, 'swipe reliability');

const semantic = buildSemanticFounderState({
  agent: 'coder',
  intent: parsedFixThem.intent,
  topic: parsedFixThem.topic,
  state,
  priorMemory: {
    ...prior,
    currentContinuity: parsedFixThem.continuity
  }
});

assert.strictEqual(semantic.founderGoal, 'make keyboard feel premium');
assert.strictEqual(semantic.activeFocus, 'swipe reliability');
assert.strictEqual(semantic.currentFrustration, 'swipe reliability');
assert.strictEqual(semantic.unresolvedReference, 'swipe reliability');
assert.strictEqual(semantic.desiredOutcome, 'make keyboard feel premium');
assert.strictEqual(semantic.lastRequestedAction, 'fix');
assert.strictEqual(semantic.activeRuntimeProblem, 'swipe reliability');
assert(semantic.blockedPriority.includes('Trail continuity'));
assert.strictEqual(semantic.preferredResponseStyle, 'mobile-first short worker updates');
assert(semantic.repeatedPainPoints.length <= 5);
assert(!Object.prototype.hasOwnProperty.call(semantic, 'rawConversation'));
assert(semantic.contextConfidence >= 0.7);
assert.deepStrictEqual(semantic.semanticConflicts, []);

assert.strictEqual(resolveSemanticReference('fix them', semantic), 'swipe reliability');
assert.strictEqual(resolveSemanticReference('what happened after that', semantic), 'swipe reliability');

const priorities = rankProductPriorities(state, semantic);
assert.strictEqual(priorities[0].signal, 'swipe reliability');
assert(priorities[0].evidence.includes('Swipe') || priorities[0].evidence.includes('Trail'));
assert(priorities.find((item) => item.signal === 'maintainability').rank > priorities[0].rank);

const operational = buildOperationalIntelligence(overengineeringState, semantic, {
  productFeelWins: ['Reduced symbol switching friction in previous pass.'],
  regressionCauses: ['Large routing abstraction made debugging harder.'],
  founderRejectedPatterns: ['more reports without typing improvement'],
  frictionReducers: ['short mobile worker updates'],
  fakeProgressPatterns: ['architecture report loop']
});
assert.strictEqual(operational.strategicPriorities[0].signal, 'typing confidence');
assert(operational.runtimeRealityRanking[0].signal.includes('real-device'));
assert(operational.executionMemory.fakeProgressPatterns.includes('architecture report loop'));
assert(operational.contradictionWarnings.includes('complexity_without_ux_improvement'));
assert(operational.pushback.required);
assert(operational.pushback.message.includes('push back'));
assert(!/auto.?push|workflow mutation|dependency mutation/i.test(operational.nextSafeAction));

const overengineeringMemory = buildConversationMemory({
  agent: 'cto',
  intent: 'summary',
  topic: 'new abstraction layer',
  state: overengineeringState,
  priorMemory: {
    currentContinuity: { normalized: 'cto update me' },
    founderRejectedPatterns: ['more reports without typing improvement'],
    fakeProgressPatterns: ['architecture report loop']
  }
});
assert(overengineeringMemory.operationalIntelligence.pushback.required);
const pushbackResponse = routeMessage('cto update me', overengineeringState, overengineeringMemory).response;
assert(pushbackResponse.includes('push back'));
assert(pushbackResponse.includes('typing') || pushbackResponse.includes('UX'));
assert(pushbackResponse.split('\n').length <= 5);

const unresolvedTopics = rankUnresolvedTopics(state, semantic);
assert.strictEqual(unresolvedTopics[0].topic, 'swipe reliability');
assert(unresolvedTopics[0].weight > unresolvedTopics[1].weight);

const plan = continuationPlan(state, semantic);
assert.strictEqual(plan.allowed, true);
assert.strictEqual(plan.executionMode, 'analysis_and_proposal_only');
assert(plan.nextAction.includes('diagnostic') || plan.nextAction.includes('Measure'));
assert(!/push|delete|workflow|dependency/i.test(plan.nextAction));

const conflictState = buildSemanticFounderState({
  agent: 'cto',
  intent: 'current_work',
  topic: 'cosmetic cleanup',
  state,
  priorMemory: {
    activeFocus: 'swipe reliability',
    unresolvedReference: 'swipe reliability',
    currentContinuity: { normalized: 'continue that', continuationRequested: true, requestedAction: 'continue' }
  }
});
assert(detectSemanticConflicts(conflictState).includes('focus_conflicts_with_runtime_problem'));
assert(scoreContextConfidence(conflictState) < semantic.contextConfidence);

const oldMemory = {
  ...prior,
  semanticFounderState: {
    ...semantic,
    lastUpdatedAt: '2026-04-01T00:00:00.000Z'
  },
  lastUpdatedAt: '2026-04-01T00:00:00.000Z'
};
const stabilizedOld = stabilizeSemanticMemory(oldMemory);
assert.strictEqual(stabilizedOld.activeFocus, 'swipe reliability');
assert(stabilizedOld.contextConfidence < 0.5);
assert(stabilizedOld.semanticConflicts.includes('old_context_low_confidence'));

const memory = buildConversationMemory({
  agent: 'coder',
  intent: parsedFixThem.intent,
  topic: parsedFixThem.topic,
  state,
  priorMemory: {
    ...prior,
    currentContinuity: parsedFixThem.continuity
  }
});

assert.strictEqual(memory.semanticFounderState.activeFocus, 'swipe reliability');
assert.strictEqual(memory.resolvedReference, 'swipe reliability');
assert.strictEqual(memory.nextContinuationAction.executionMode, 'analysis_and_proposal_only');
assert.strictEqual(memory.productPriorities[0].signal, 'swipe reliability');
assert(memory.semanticFounderState.contextConfidence >= 0.7);

const response = routeMessage('fix them', state, memory).response;
assert(response.includes('CODER') || response.includes('CTO'));
assert(response.includes('swipe reliability') || response.includes('swipe'));
assert(/No major typing improvement yet|not proven fixed|Not claiming it fixed yet/.test(response));
assert(response.split('\n').length <= 5);

const uncertainMemory = buildConversationMemory({
  agent: 'cto',
  intent: 'current_work',
  topic: 'cosmetic cleanup',
  state,
  priorMemory: {
    activeFocus: 'swipe reliability',
    unresolvedReference: 'swipe reliability',
    currentContinuity: { normalized: 'continue that', continuationRequested: true, requestedAction: 'continue' }
  }
});
const uncertainResponse = routeMessage('continue that', state, uncertainMemory).response;
assert(uncertainResponse.includes('not fully verified yet'));
assert(uncertainResponse.split('\n').length <= 5);

console.log('Contextual reasoning workforce checks passed.');
