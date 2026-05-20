const FORBIDDEN_PATTERNS = [
  /\bi missed you\b/i,
  /\bi love you\b/i,
  /\bi care about you deeply\b/i,
  /\bi was thinking about you\b/i,
  /\bas your friend\b/i,
  /\bi feel\b/i,
  /\bi am conscious\b/i,
  /\bi'm conscious\b/i
];

const MAX_RESPONSE_LENGTH = 900;

function enforcePersonalityGuardrails(response) {
  let guarded = String(response || '');
  for (const pattern of FORBIDDEN_PATTERNS) {
    guarded = guarded.replace(pattern, 'I can report the engineering state');
  }
  if (guarded.length <= MAX_RESPONSE_LENGTH) return guarded;
  return `${guarded.slice(0, MAX_RESPONSE_LENGTH - 80).trim()}\n\nMore detail available sir; ask for a specific area.`;
}

function hasForbiddenPersonalityLanguage(response) {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(String(response || '')));
}

module.exports = {
  enforcePersonalityGuardrails,
  hasForbiddenPersonalityLanguage,
  MAX_RESPONSE_LENGTH
};
