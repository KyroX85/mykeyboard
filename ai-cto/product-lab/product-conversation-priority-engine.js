function prioritizeProductConversation(message = '') {
  const text = String(message || '').toLowerCase();
  if (text.includes('retention')) return priority('retention', 1);
  if (text.includes('trust')) return priority('trust', 2);
  if (text.includes('gboard') || text.includes('immature')) return priority('maturity comparison', 3);
  if (text.includes('stable') || text.includes('safer')) return priority('stability', 4);
  return priority('product discussion', 5);
}

function priority(primary, rank) {
  return {
    primary,
    rank,
    conversationFirst: true
  };
}

module.exports = { prioritizeProductConversation };
