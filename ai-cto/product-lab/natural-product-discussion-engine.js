function answerNaturalProductDiscussion({ message = '', productContext = {} } = {}) {
  const text = String(message || '').toLowerCase();
  if (text.includes('immature') && text.includes('gboard')) {
    return 'Visual calmness and spacing rhythm still feel less mature than Gboard. Swipe confidence also appears less inevitable under compact layouts.';
  }
  if (text.includes('trust')) {
    return `Probably ${productContext.highestTrustPressure || 'swipe hesitation near edge regions and occasional visual density tension'}.`;
  }
  if (text.includes('stable') || text.includes('change anything')) {
    return productContext.saferToday || 'Current evidence suggests stability may be more valuable than another product experiment today.';
  }
  if (text.includes('recurring friction')) {
    return productContext.recurringFriction || 'The recurring friction to watch is compact layout density and symbol access comfort.';
  }
  if (text.includes('users dislike') || text.includes('worries')) {
    return 'Users usually dislike subtle unpredictability: cramped touch targets, hesitant swipes, aggressive corrections, and visual density that makes typing feel heavier.';
  }
  return 'I would keep this as product discussion first: reason from evidence, compare against mature keyboard feel, then only propose a bounded experiment if the benefit is clear.';
}

module.exports = { answerNaturalProductDiscussion };
