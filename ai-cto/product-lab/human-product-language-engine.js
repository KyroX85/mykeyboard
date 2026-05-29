function normalizeHumanProductLanguage(message = '') {
  const text = String(message || '').toLowerCase();
  if (text.includes('constructed') || text.includes('natural')) return item('naturalness');
  if (text.includes('visually') || text.includes('visual')) return item('visual comfort');
  if (text.includes('immature') || text.includes('polished')) return item('maturity');
  if (text.includes('cramped')) return item('spacing comfort');
  if (text.includes('trust')) return item('typing trust');
  return item('product feel');
}

function item(topic) {
  return {
    topic,
    mode: 'PRODUCT_DISCUSSION'
  };
}

module.exports = { normalizeHumanProductLanguage };
