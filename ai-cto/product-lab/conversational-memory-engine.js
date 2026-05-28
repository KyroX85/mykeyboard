const fs = require('fs');
const path = require('path');

const FILE = 'conversation-memory.json';

function loadConversationMemory(root = process.cwd()) {
  const file = path.join(root, FILE);
  if (!fs.existsSync(file)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
}

function rememberConversationTurn({
  root = process.cwd(),
  message = '',
  mode = 'CONVERSATION',
  topic = '',
  activeConcern = '',
  screenshotThread = '',
  roadmapDiscussion = '',
  uxIssue = '',
  subsystemFocus = ''
} = {}) {
  const memory = loadConversationMemory(root);
  const inferredTopic = topic || inferTopic(message);
  memory.currentTopic = inferredTopic || memory.currentTopic;
  memory.activeConcern = activeConcern || memory.activeConcern;
  memory.currentScreenshotThread = screenshotThread || memory.currentScreenshotThread;
  memory.currentRoadmapDiscussion = roadmapDiscussion || memory.currentRoadmapDiscussion;
  memory.currentUxIssue = uxIssue || memory.currentUxIssue;
  memory.subsystemFocus = subsystemFocus || inferSubsystem(message) || memory.subsystemFocus;
  memory.lastMode = mode;
  memory.turns = [
    {
      mode,
      topic: inferredTopic,
      message: String(message).slice(0, 220),
      recordedAt: new Date().toISOString()
    },
    ...memory.turns
  ].slice(0, 50);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(memory, null, 2));
  return memory;
}

function inferTopic(message = '') {
  const text = String(message).toLowerCase();
  if (text.includes('trust')) return 'typing trust';
  if (text.includes('screenshot') || text.includes('gboard')) return 'screenshot comparison';
  if (text.includes('friction')) return 'recurring friction';
  if (text.includes('stable') || text.includes('safer')) return 'stability tradeoff';
  return '';
}

function inferSubsystem(message = '') {
  const text = String(message).toLowerCase();
  if (text.includes('symbol')) return 'symbol ergonomics';
  if (text.includes('swipe')) return 'swipe trust';
  if (text.includes('typing')) return 'typing feel';
  if (text.includes('dark')) return 'dark-mode readability';
  return '';
}

function empty() {
  return {
    version: '1.0',
    updatedAt: null,
    currentTopic: '',
    activeConcern: '',
    currentScreenshotThread: '',
    currentRoadmapDiscussion: '',
    currentUxIssue: '',
    subsystemFocus: '',
    lastMode: 'CONVERSATION',
    turns: []
  };
}

module.exports = {
  loadConversationMemory,
  rememberConversationTurn
};
