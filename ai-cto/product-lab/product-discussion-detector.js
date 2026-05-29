const PRODUCT_LANGUAGE = /\b(ux|visual|visually|tense|immature|worries|worry|gboard|swiftkey|users|dislike|friction|repeats|mature keyboards|avoid|cramped|annoy|polished|trust|constructed|natural|keyboard|typing|swipe|symbol|retention|comfort|feel|feels|layout|spacing|dense|calm|change|stable|stability|prediction|predictor)\b/i;
const QUESTION_LANGUAGE = /\b(what|why|how|should|would|could|compare|feels?|worries?|avoid|dislike|annoy)\b/i;

function detectProductDiscussion(message = '') {
  const text = String(message || '').trim();
  const productHits = countMatches(text, PRODUCT_LANGUAGE);
  const hasQuestion = QUESTION_LANGUAGE.test(text) || text.endsWith('?');
  const isProductDiscussion = PRODUCT_LANGUAGE.test(text) && hasQuestion;
  const confidence = isProductDiscussion
    ? Math.min(100, 72 + productHits * 8 + (hasQuestion ? 10 : 0))
    : PRODUCT_LANGUAGE.test(text)
      ? 55
      : 0;
  return {
    isProductDiscussion,
    confidence,
    reason: isProductDiscussion
      ? 'normal product, UX, trust, or keyboard-feel discussion'
      : 'no clear product discussion language'
  };
}

function countMatches(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return (String(text).match(new RegExp(pattern.source, flags)) || []).length;
}

module.exports = { detectProductDiscussion };
