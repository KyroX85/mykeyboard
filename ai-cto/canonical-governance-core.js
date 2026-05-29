function resolveCanonicalGovernance() {
  return {
    authority: 'MyKeyboard/ai-cto/canonical-governance-core.js',
    enforcementPath: 'existing runtime governance remains active; this core declares single authority only',
    preservationModePolicy: 'one behavior regardless of launch root',
    convergenceStatus: 'DECLARED_NOT_REPLACED',
    forbiddenNow: ['direct enforcement replacement', 'package path rewrite', 'WhatsApp route rewrite']
  };
}

module.exports = { resolveCanonicalGovernance };
