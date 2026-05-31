const { hashSummary, summarizeBody } = require('./notification-memory');

function checkNotificationDuplicate(body = '', memory = {}, {
  threshold = 0.8,
  windowSize = 50
} = {}) {
  const recent = Array.isArray(memory.notifications)
    ? memory.notifications.slice(-windowSize)
    : [];
  const summary = summarizeBody(body);
  const summaryHash = hashSummary(summary);
  const currentTokens = tokenSet(summary);

  let best = {
    duplicate: false,
    similarity: 0,
    matched: null,
    summary,
    summaryHash
  };

  for (const item of recent) {
    const similarity = Math.max(
      item.summaryHash === summaryHash ? 1 : 0,
      jaccard(currentTokens, tokenSet(item.summary || ''))
    );
    if (similarity > best.similarity) {
      best = {
        duplicate: similarity >= threshold,
        similarity,
        matched: item,
        summary,
        summaryHash
      };
    }
  }

  return best;
}

function tokenSet(value = '') {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'is', 'are', 'was', 'were', 'this', 'that']);
  return new Set(String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stop.has(token)));
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

module.exports = {
  checkNotificationDuplicate,
  jaccard,
  tokenSet
};
