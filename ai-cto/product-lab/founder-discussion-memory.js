const fs = require('fs');
const path = require('path');

const FILE = 'founder-discussion-memory.json';

function loadFounderDiscussionMemory(root = process.cwd()) {
  const file = path.join(root, FILE);
  if (!fs.existsSync(file)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
}

function rememberFounderDiscussion({
  root = process.cwd(),
  message = '',
  topic = '',
  productConcern = ''
} = {}) {
  const memory = loadFounderDiscussionMemory(root);
  memory.currentTopic = topic || inferTopic(message) || memory.currentTopic;
  memory.activeProductConcern = productConcern || memory.activeProductConcern;
  memory.turns = [
    {
      message: String(message).slice(0, 220),
      topic: memory.currentTopic,
      recordedAt: new Date().toISOString()
    },
    ...memory.turns
  ].slice(0, 60);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(memory, null, 2));
  return memory;
}

function inferTopic(message = '') {
  const text = String(message).toLowerCase();
  if (text.includes('gboard')) return 'Gboard maturity comparison';
  if (text.includes('trust')) return 'typing trust';
  if (text.includes('friction')) return 'recurring friction';
  return 'product discussion';
}

function empty() {
  return {
    version: '1.0',
    updatedAt: null,
    currentTopic: '',
    activeProductConcern: '',
    turns: []
  };
}

module.exports = {
  loadFounderDiscussionMemory,
  rememberFounderDiscussion
};
