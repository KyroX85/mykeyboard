const { answerFounderAlignedProductQuestion } = require('../canonical-product-judgment-engine');

function answerCalmDialogue({ message = '', productContext = {} } = {}) {
  const founderAnswer = answerFounderAlignedProductQuestion(message, productContext);
  if (founderAnswer) return founderAnswer.response;

  const text = String(message || '').toLowerCase();
  if (text.includes('visually tense')) {
    return sentence(productContext.visualTension || 'Spacing near the edges still feels slightly dense compared to Gboard.');
  }
  if (text.includes('immature') || text.includes('less polished')) {
    return sentence(`The less mature parts are ${productContext.immatureAgainstGboard || 'visual calmness, spacing rhythm, and compact swipe confidence'}.`);
  }
  if (text.includes('worries')) {
    return sentence(`I would watch ${productContext.highestTrustPressure || 'edge swipe hesitation and dense compact layout rhythm'} first.`);
  }
  if (text.includes('not change') || text.includes('avoid')) {
    return sentence(`I would avoid changing ${productContext.doNotChange || 'prediction behavior without stronger evidence'}.`);
  }
  if (text.includes('users dislike') || text.includes('annoy')) {
    return 'Users would probably dislike cramped targets, inconsistent correction behavior, and anything that makes typing feel heavier.';
  }
  if (text.includes('constructed') || text.includes('natural')) {
    return 'The keyboard can feel constructed when spacing rhythm, symbols, and correction behavior do not feel predictable together.';
  }
  return 'I would treat that as product discussion and answer from typing trust, visual calmness, and long-session comfort.';
}

function sentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text[0].toUpperCase() + text.slice(1) : `${text[0].toUpperCase()}${text.slice(1)}.`;
}

module.exports = { answerCalmDialogue };
