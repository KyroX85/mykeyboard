const FOUNDER_DNA_CORE = Object.freeze({
  authority: 'MyKeyboard/ai-cto/founder-dna-core.js',
  donorAuthority: 'C:\\Users\\ADMIN\\ai-cto',
  absorptionMode: 'SEMANTIC_ABSORPTION_COMPLETE_NO_FOLDER_MERGE',
  productNorthStar: 'Retention through typing trust.',
  hierarchy: [
    'typing trust before intelligence',
    'trust over intelligence',
    'retention over features',
    'stability over sophistication',
    'evidence over assumptions',
    'governance over autonomy',
    'conversation before execution',
    'privacy reality before privacy claims'
  ],
  phaseOnePriorities: [
    'typing feel',
    'swipe trust',
    'responsiveness',
    'symbol ergonomics',
    'long-session stability',
    'correction burden reduction',
    'install/update reliability',
    'dark-mode readability',
    'battery efficiency',
    'regression prevention'
  ],
  productTaste: [
    'typing rhythm must feel uninterrupted',
    'the keyboard should disappear during use',
    'corrections should feel calm, not aggressive',
    'symbol access should not create thumb anxiety',
    'visual density should stay mature and low-fatigue',
    'small changes beat rewrites unless evidence proves otherwise',
    'doing nothing is valid when evidence is weak'
  ],
  forbiddenDrift: [
    'architecture vanity',
    'AI sophistication without retention evidence',
    'fake emotional companion behavior',
    'cloud-first typing intelligence',
    'raw typing collection',
    'hidden telemetry',
    'autonomous hot-path mutation',
    'large rewrites from chat',
    'memory split-brain',
    'governance split-brain'
  ],
  executionDoctrine: [
    'discussion is not execution',
    'execution requires explicit activation',
    'preservation mode blocks mutation before execution',
    'protected files require evidence, approval, rollback, and validation',
    'reports are optional unless explicitly requested',
    'agents should recommend one safest next action, not menus by default'
  ],
  privacyDoctrine: [
    'local-first is product trust, not branding',
    'raw typed text must not leave the device',
    'scripted Product Lab screenshots are allowed',
    'personal screenshots are not allowed as artifacts',
    'dataset claims require visible topology and retention rules'
  ],
  convergenceDoctrine: [
    'MyKeyboard/ai-cto is the canonical execution nervous system',
    'C:\\Users\\ADMIN\\ai-cto remains preserved donor DNA until founder approves retirement',
    'paths are part of runtime identity',
    'shadow systems retire only after import, workflow, package, WhatsApp, and memory proof'
  ]
});

function getFounderDnaCore() {
  return FOUNDER_DNA_CORE;
}

function containsFounderDoctrine(text = '') {
  const normalized = String(text || '').toLowerCase();
  return [
    'trust',
    'retention',
    'typing',
    'swipe',
    'calm',
    'gboard',
    'friction',
    'immature',
    'stable',
    'architecture',
    'privacy',
    'governance',
    'whatsapp',
    'agents',
    'improve',
    'screenshot',
    'screen',
    'visual evidence',
    'product lab',
    'what hurts',
    'what feels',
    'not change',
    'avoid',
    'product lab'
  ].some((term) => normalized.includes(term));
}

module.exports = {
  FOUNDER_DNA_CORE,
  containsFounderDoctrine,
  getFounderDnaCore
};
