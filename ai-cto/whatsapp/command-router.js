const { generateResponse } = require('./response-generator');

const COMMAND_ALIASES = new Map([
  ['status', 'status'],
  ['cto status', 'status'],
  ['health', 'health'],
  ['score', 'health'],
  ['risks', 'risks'],
  ['risk', 'risks'],
  ['momentum', 'momentum'],
  ['latest fixes', 'latest_fixes'],
  ['fixes', 'latest_fixes'],
  ['pending issues', 'pending_issues'],
  ['issues', 'pending_issues'],
  ['pending', 'pending_issues'],
  ['next priorities', 'next_priorities'],
  ['next priority', 'next_priorities'],
  ['priorities', 'next_priorities'],
  ['priority', 'next_priorities'],
  ['approvals', 'approvals'],
  ['approval', 'approvals'],
  ['weekly summary', 'weekly_summary'],
  ['week summary', 'weekly_summary'],
  ['summary', 'weekly_summary'],
  ['help', 'help']
]);

function normalizeMessage(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolveCommand(message) {
  const normalized = normalizeMessage(message);
  if (COMMAND_ALIASES.has(normalized)) return COMMAND_ALIASES.get(normalized);

  for (const [alias, command] of COMMAND_ALIASES.entries()) {
    if (normalized.includes(alias)) return command;
  }

  return 'help';
}

function routeMessage(message, state) {
  const command = resolveCommand(message);
  return {
    command,
    response: generateResponse(command, state)
  };
}

module.exports = {
  routeMessage,
  resolveCommand,
  normalizeMessage
};
