const { buildSelectiveTransplantPlan } = require('./intelligence-transplant-engine');

function translateFounderDna(options = {}) {
  const plan = buildSelectiveTransplantPlan(options);
  return {
    sourceAuthority: plan.sourceAuthority,
    targetAuthority: plan.targetAuthority,
    translationMode: 'SEMANTIC_ONLY_NO_RUNTIME_REWIRE',
    translatedPrinciples: [
      'trust over intelligence',
      'retention over sophistication',
      'stability over features',
      'evidence over assumptions',
      'calm execution over architecture churn'
    ],
    safeCandidates: plan.safeCandidates
  };
}

module.exports = { translateFounderDna };
