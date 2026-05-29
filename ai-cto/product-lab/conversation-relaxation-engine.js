function relaxConversation({ response = '', productDiscussion = false } = {}) {
  if (!productDiscussion) return response;
  return String(response || '')
    .replace(/NOISE \/ STRESS TEST DETECTED\.?\s*/gi, '')
    .replace(/LOW INFORMATION DETECTED\.?\s*/gi, '')
    .replace(/AMBIGUOUS INTENT DETECTED\.?\s*/gi, '')
    .replace(/Governance warning\.?\s*/gi, '')
    .replace(/BLOCKED\.?\s*/gi, '')
    .trim();
}

module.exports = { relaxConversation };
