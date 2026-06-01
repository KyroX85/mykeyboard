const { hashSummary, summarizeBody } = require('./notification-memory');

function checkNotificationDuplicate(body = '', memory = {}, {
  threshold = 0.8,
  windowSize = 50,
  now = new Date(),
  duplicateWindowMs = 24 * 60 * 60 * 1000
} = {}) {
  const recent = Array.isArray(memory.notifications)
    ? memory.notifications.slice(-windowSize)
    : [];
  const summary = summarizeBody(body);
  const summaryHash = hashSummary(summary);
  const currentTokens = tokenSet(summary);
  const founderLastSeenAt = memory.founderActivity && memory.founderActivity.lastSeenAt
    ? new Date(memory.founderActivity.lastSeenAt)
    : null;

  let best = {
    duplicate: false,
    similarity: 0,
    matched: null,
    summary,
    summaryHash,
    reason: 'unique',
    ignored: false,
    within24h: false
  };

  for (const item of recent) {
    const similarity = Math.max(
      item.summaryHash === summaryHash ? 1 : 0,
      jaccard(currentTokens, tokenSet(item.summary || ''))
    );
    const itemTime = new Date(item.timestamp || 0);
    const elapsedMs = now.getTime() - itemTime.getTime();
    const within24h = Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < duplicateWindowMs;
    const ignored = item.sent !== false &&
      (!founderLastSeenAt || founderLastSeenAt.getTime() <= itemTime.getTime());
    const duplicate = similarity >= threshold && (within24h || ignored);
    if (similarity > best.similarity) {
      best = {
        duplicate,
        similarity,
        matched: item,
        summary,
        summaryHash,
        reason: duplicate
          ? (within24h ? 'duplicate_24h' : 'founder_ignored_previous_issue')
          : 'similar_but_outside_suppression_window',
        ignored,
        within24h
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
