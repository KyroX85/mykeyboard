function reasonAboutProductQuestion({ message = '', productContext = {} } = {}) {
  const text = String(message).toLowerCase();
  if (text.includes('gboard') || text.includes('swiftkey')) {
    return {
      topic: 'mature keyboard comparison',
      evidenceNeed: 'screenshot baseline and current Aritenis screenshot',
      answerFocus: 'spacing, thumb confidence, visual density, symbol access, and calmness'
    };
  }
  if (text.includes('trust')) {
    return {
      topic: 'typing trust',
      evidenceNeed: 'recurring friction, correction burden, swipe hesitation, and visual discomfort',
      answerFocus: productContext.highestPressure || 'highest Phase 1 pressure'
    };
  }
  return {
    topic: 'product discussion',
    evidenceNeed: 'product context',
    answerFocus: 'safe Phase 1 reasoning'
  };
}

module.exports = { reasonAboutProductQuestion };
