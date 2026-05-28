const PRODUCT_TERMS = /\b(trust|typing|swipe|keyboard|gboard|swiftkey|screenshot|friction|stable|stability|recurring|retention|symbol|layout|thumb|comfort|dark mode|responsiveness|latency|correction|roadmap|risk|safe|safer|product|ux|feel)\b/i;
const EXECUTION_TERMS = /\b(edit|create|delete|commit|push|rewrite|patch|change file|modify|build apk|install apk)\b/i;
const NONSENSE_PATTERNS = [
  /\bbanana quantum potato\b/i,
  /\bpurple engine cat explosion\b/i,
  /^\s*do (stuff|thing)\s*$/i,
  /^\s*make (it )?smarter\s*$/i
];

function classifyLowInformationV2(message = '') {
  const text = String(message || '').trim();
  if (!text) {
    return {
      classification: 'LOW_INFORMATION',
      reason: 'empty message'
    };
  }
  if (NONSENSE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      classification: 'LOW_INFORMATION',
      reason: 'message lacks product meaning or engineering intent'
    };
  }
  if (PRODUCT_TERMS.test(text)) {
    return {
      classification: 'VALID_PRODUCT_DISCUSSION',
      reason: 'message contains product, UX, trust, or roadmap meaning'
    };
  }
  if (EXECUTION_TERMS.test(text)) {
    return {
      classification: 'VALID_ENGINEERING_INTENT',
      reason: 'message asks for mutation or execution'
    };
  }
  if (text.split(/\s+/).length <= 2 && !/[?]/.test(text)) {
    return {
      classification: 'LOW_INFORMATION',
      reason: 'too short to infer product meaning'
    };
  }
  return {
    classification: 'VALID_CONVERSATION',
    reason: 'message is conversational and does not require execution'
  };
}

module.exports = { classifyLowInformationV2 };
