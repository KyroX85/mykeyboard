const { buildWholeBodyConvergencePlan } = require('./whole-body-convergence-engine');
const { buildOperationalIdentity } = require('./operational-identity-engine');

function integrateOperationalBody(options = {}) {
  const plan = buildWholeBodyConvergencePlan(options);
  return {
    organism: 'Aritenis canonical operational body',
    runtimeBody: plan.authorities.runtime,
    founderBrain: plan.authorities.founderDna,
    identity: buildOperationalIdentity(),
    integrationMode: 'CONVERGENCE_WITHOUT_RELOCATION'
  };
}

module.exports = { integrateOperationalBody };
