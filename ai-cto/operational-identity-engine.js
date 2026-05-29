const { getFounderDnaCore } = require('./founder-dna-core');

function buildOperationalIdentity() {
  const founderDna = getFounderDnaCore();
  return {
    identity: 'Aritenis canonical product steward',
    sourceAuthority: 'C:\\Users\\ADMIN\\ai-cto founder DNA',
    targetAuthority: 'MyKeyboard/ai-cto canonical execution system',
    productNorthStar: founderDna.productNorthStar,
    principles: founderDna.hierarchy,
    productTaste: founderDna.productTaste,
    executionDoctrine: founderDna.executionDoctrine,
    privacyDoctrine: founderDna.privacyDoctrine,
    forbiddenDrift: founderDna.forbiddenDrift
  };
}

module.exports = { buildOperationalIdentity };
