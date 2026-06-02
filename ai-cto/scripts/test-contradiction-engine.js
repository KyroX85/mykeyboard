const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-engine-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-contradiction-engine-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-engine-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-engine-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-contradiction-engine-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-contradiction-engine-whatsapp-memory-${Date.now()}.json`);

const {
  detectContradiction,
  updateContradictionMemory,
  formatContradictionForResponse
} = require('../contradiction-engine');
const {
  updateMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'contradiction engine test');

const founderStatementConflict = detectContradiction({
  founderMessage: 'Maybe agent sophistication matters more than user leverage now.',
  memory: {
    founderBeliefTracker: {
      currentBeliefs: [{
        belief: 'real user leverage and repeatable usefulness matter more than agent sophistication',
        confidence: 84
      }]
    }
  }
});
assert(founderStatementConflict);
assert.strictEqual(founderStatementConflict.type, 'FOUNDER_STATEMENT_CONFLICT');
assert.match(founderStatementConflict.contradiction, /agent sophistication/i);
assert.match(founderStatementConflict.whyItMatters, /new belief|founder model|wrong direction/i);
assert.match(founderStatementConflict.likelyRootCause, /belief shift|stress-testing|older assumption/i);

const strategyGoalConflict = detectContradiction({
  founderMessage: 'Let us spend the next month polishing agent orchestration and ignore Explain.',
  memory: {
    founderGoals: [{
      objective: 'Build Explain as the Phase 2 active wedge.',
      concern: 'Users need understanding before typing.'
    }]
  }
});
assert(strategyGoalConflict);
assert.strictEqual(strategyGoalConflict.type, 'STRATEGY_GOAL_CONFLICT');
assert.match(strategyGoalConflict.contradiction, /orchestration|Explain/i);
assert.match(strategyGoalConflict.whyItMatters, /delays|active wedge|user proof/i);
assert.match(strategyGoalConflict.likelyRootCause, /infrastructure|uncertainty|killer feature/i);

const directionVisionConflict = detectContradiction({
  founderMessage: 'Maybe Aritenis should become a general cloud AI chatbot instead of a keyboard Explain layer.',
  memory: {
    founderVision: 'Aritenis is a privacy-safe keyboard intelligence layer that helps users understand before typing.'
  }
});
assert(directionVisionConflict);
assert.strictEqual(directionVisionConflict.type, 'PRODUCT_DIRECTION_VISION_CONFLICT');
assert.match(directionVisionConflict.contradiction, /cloud AI chatbot|keyboard Explain/i);
assert.match(directionVisionConflict.whyItMatters, /privacy|distribution|vision/i);
assert.match(directionVisionConflict.likelyRootCause, /category drift|competing with generic AI/i);

let model = updateContradictionMemory(null, founderStatementConflict);
model = updateContradictionMemory(model, strategyGoalConflict);
assert.strictEqual(model.items.length, 2);
assert.strictEqual(model.lastContradiction.type, 'STRATEGY_GOAL_CONFLICT');

const formatted = formatContradictionForResponse(strategyGoalConflict);
assert.match(formatted, /Contradiction:/);
assert.match(formatted, /Why it matters:/);
assert.match(formatted, /Likely root cause:/);

updateMemory('founder_mind_reconstruction', {}, {
  founderMessage: 'Let us spend the next month polishing agent orchestration and ignore Explain.',
  agentAnswer: 'This may conflict with the active wedge.',
  founderGoals: [{
    objective: 'Build Explain as the Phase 2 active wedge.'
  }]
});
const memory = readConversationMemory();
assert(memory.contradictionEngine);
assert(memory.contradictionEngine.items.length >= 1);
assert.match(memory.contradictionEngine.lastContradiction.whyItMatters, /Explain|user proof|active wedge/i);

console.log('Contradiction engine checks passed.');
