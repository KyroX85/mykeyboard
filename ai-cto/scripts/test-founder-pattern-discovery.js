const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-pattern-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-pattern-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-pattern-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-pattern-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-pattern-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), `aritenis-pattern-memory-${Date.now()}.json`);

const {
  discoverFounderPatterns,
  shouldGeneratePatternReport,
  updateFounderPatternDiscovery
} = require('../founder-pattern-discovery');
const {
  writeMemory,
  readConversationMemory
} = require('../whatsapp/memory-store');

function feedback(index, text) {
  return {
    timestamp: new Date(Date.now() - index * 60000).toISOString(),
    polarity: index % 3 === 0 ? 'positive' : 'negative',
    feedback: index % 2 === 0 ? 'too_generic' : 'good_answer',
    questionPattern: text,
    answerPattern: index % 2 === 0
      ? 'health momentum status template'
      : 'dream strategy user value product truth'
  };
}

const memory = {
  founderFeedback: Array.from({ length: 50 }, (_, index) => feedback(index, [
    'bro are we moving toward the dream',
    'i am scared we are building impressive instead of useful',
    'i do not think users actually care',
    'what am i missing',
    'if we fail in three years why do we fail'
  ][index % 5])),
  founderDoubts: [
    { concern: 'building impressive systems instead of useful product value', objective: 'avoid architecture theatre' },
    { concern: 'users may not care about Explain unless it becomes a habit', objective: 'prove user pull' },
    { concern: 'agents may still be dumb and template driven', objective: 'make agents understand founder intent' }
  ],
  founderGoals: [
    { objective: 'build a personal intelligence layer through the keyboard', actualQuestion: 'what am i chasing' },
    { objective: 'create user-facing leverage with Explain', actualQuestion: 'what is the wedge' },
    { objective: 'make agents improve product while founder is absent', actualQuestion: 'what happens if i disappear' }
  ],
  founderQuestionClusters: {
    recentQuestions: Array.from({ length: 12 }, (_, index) => ({
      family: ['dream questions', 'user value questions', 'premortem questions'][index % 3],
      messagePattern: ['moving toward dream', 'users care', 'why fail'][index % 3]
    }))
  }
};

assert.strictEqual(shouldGeneratePatternReport(memory), true);

const report = discoverFounderPatterns(memory);
assert(report.repeatedFears.some((item) => /impressive|users may not care|template/i.test(item.pattern)));
assert(report.repeatedFrustrations.some((item) => /health|momentum|template|generic/i.test(item.pattern)));
assert(report.repeatedGoals.some((item) => /intelligence layer|Explain|absent/i.test(item.pattern)));
assert(report.repeatedQuestions.some((item) => /dream questions|user value questions|premortem/i.test(item.pattern)));
assert(report.unnoticedPatterns.some((item) => /usefulness anxiety|agent capability anxiety|dream alignment/i.test(item.pattern)));
assert(report.confidence <= 90);

const updated = updateFounderPatternDiscovery(null, memory);
assert(updated.lastReport);
assert.strictEqual(updated.lastConversationBucket, 1);
assert.strictEqual(updated.reports.length, 1);

const unchanged = updateFounderPatternDiscovery(updated, memory);
assert.strictEqual(unchanged.reports.length, 1);

writeMemory(memory);
const stored = readConversationMemory();
assert(stored.founderPatternDiscovery);
assert(stored.founderPatternDiscovery.lastReport);
assert(stored.founderPatternDiscovery.lastReport.repeatedFears.length > 0);

console.log('Founder pattern discovery checks passed.');
