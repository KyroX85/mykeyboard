const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  BASELINE_EVOLUTION,
  EVOLUTION_MARKDOWN_FILE,
  EVOLUTION_STATE_FILE,
  buildFounderEvolutionContext,
  buildFounderEvolutionSnapshot,
  loadFounderEvolution,
  shouldUpdateFounderEvolution,
  updateFounderEvolution
} = require('../founder-evolution-layer');
const {
  MEMORY_AUDIT,
  loadFounderMemoryLayer,
  retrieveRelevantFounderMemories
} = require('../founder-memory-layer');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aritenis-founder-evolution-'));
const aiCto = path.join(root, 'ai-cto');
fs.mkdirSync(aiCto, { recursive: true });
for (const file of ['FOUNDER_VISION.md', 'PROJECT_STATE.md', 'CURRENT_STAGE.md', 'REJECTED_DIRECTIONS.md', 'ACTIVE_HYPOTHESES.md']) {
  fs.writeFileSync(path.join(aiCto, file), `${file}\nAritenis founder memory for Explain, trust, rejected paths, and Phase 2 active state.\n`);
}

const now = new Date('2026-06-01T00:00:00.000Z');
const conversationMemory = {
  founderGoals: [{
    objective: 'Founder wants phone-operated agents that move toward the dream.'
  }],
  founderDoubts: [{
    concern: 'Founder worries agents are improving infrastructure instead of the killer user moment.'
  }],
  founderConcerns: [{
    concern: 'Founder dislikes fake progress and template answers.'
  }],
  founderRejectedPatterns: ['bureaucracy without product leverage'],
  recentMessages: [{
    founderMessage: 'Explain screenshot should prove understanding.',
    summary: 'Discussed Explain screenshot proof.'
  }]
};

assert.strictEqual(shouldUpdateFounderEvolution({ lastUpdatedAt: null }, now), true);
assert.strictEqual(shouldUpdateFounderEvolution({
  lastUpdatedAt: '2026-05-31T00:00:00.000Z'
}, now), false);
assert.strictEqual(shouldUpdateFounderEvolution({
  lastUpdatedAt: '2026-05-20T00:00:00.000Z'
}, now), true);

const snapshot = buildFounderEvolutionSnapshot({
  now,
  memoryAudit: MEMORY_AUDIT,
  conversationMemory,
  previousEvolution: BASELINE_EVOLUTION
});
assert(snapshot.founderGoals.some((item) => /Aritenis|phone-operated/i.test(item)));
assert(snapshot.activeFrustrations.some((item) => /infrastructure|fake progress|template/i.test(item)));
assert(snapshot.activeHypotheses.some((item) => /Explain|screenshot/i.test(item)));
assert(snapshot.rejectedPaths.some((item) => /bureaucracy|cloud telemetry|auto-send/i.test(item)));
assert(snapshot.confidence <= 90);

const updated = updateFounderEvolution({
  root,
  now,
  memoryAudit: MEMORY_AUDIT,
  conversationMemory,
  force: true
});
assert.strictEqual(updated.updated, true);
assert(fs.existsSync(path.join(aiCto, EVOLUTION_STATE_FILE)));
assert(fs.existsSync(path.join(aiCto, EVOLUTION_MARKDOWN_FILE)));

const loaded = loadFounderEvolution({ root });
assert(loaded.activeFrustrations.some((item) => /killer user moment|fake progress/i.test(item)));
assert.match(buildFounderEvolutionContext(loaded), /Founder evolution layer:/);

const memoryLayer = loadFounderMemoryLayer({ root });
assert(memoryLayer.founderEvolution);
assert(memoryLayer.memoryItems.some((item) => item.category === 'founder_evolution'));
const retrieved = retrieveRelevantFounderMemories('What are we missing as founder changes?', memoryLayer);
assert(retrieved.items.some((item) => item.category === 'founder_evolution'));

const notDue = updateFounderEvolution({
  root,
  now: new Date('2026-06-02T00:00:00.000Z'),
  memoryAudit: MEMORY_AUDIT,
  conversationMemory
});
assert.strictEqual(notDue.updated, false);
assert.strictEqual(notDue.reason, 'not_due');

console.log('Founder evolution layer checks passed');
