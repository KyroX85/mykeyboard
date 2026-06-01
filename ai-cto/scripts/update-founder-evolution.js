const path = require('path');
const { MEMORY_AUDIT } = require('../founder-memory-layer');
const { readConversationMemory } = require('../whatsapp/memory-store');
const {
  formatFounderEvolutionMarkdown,
  updateFounderEvolution
} = require('../founder-evolution-layer');

const ROOT = path.resolve(__dirname, '..', '..');
const force = process.argv.includes('--force');

const result = updateFounderEvolution({
  root: ROOT,
  memoryAudit: MEMORY_AUDIT,
  conversationMemory: readConversationMemory(),
  force
});

if (result.updated) {
  console.log('Founder evolution updated.');
} else {
  console.log(`Founder evolution not updated: ${result.reason}.`);
}

console.log(formatFounderEvolutionMarkdown(result.evolution));
