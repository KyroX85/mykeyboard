const VALUE_PATTERNS = /\b(user|product|ux|typing|keyboard|screenshot|explain|reply|action surface|workflow|retention|gboard|founder-facing)\b/i;
const CAPABILITY_PATTERNS = /\b(add|added|implement|implemented|enable|enabled|support|capture|compare|send|workflow|dispatch|artifact|fallback|permission)\b/i;
const INTELLIGENCE_PATTERNS = /\b(intent|understand|understanding|memory|retrieval|relevance|reasoning|dream|alignment|objective|conversation|anti-template|mind|semantic)\b/i;
const TRUST_PATTERNS = /\b(trust|privacy|safe|safety|guard|block|governance|approval|confirmation|no auto|no raw|protect|anti-template|reliability)\b/i;
const THEATRE_PATTERNS = /\b(report|documentation|docs|summary|architecture|cleanup|refactor|abstraction|formatting|briefing|audit)\b/i;

function evaluateFounderFacingProgress({
  items = [],
  context = ''
} = {}) {
  const normalizedItems = array(items).map((item) => String(item || '').trim()).filter(Boolean);
  const text = [context, ...normalizedItems].join(' ');
  const checks = {
    userValue: VALUE_PATTERNS.test(text) && !onlyTheatre(text),
    capability: CAPABILITY_PATTERNS.test(text) && !onlyTheatre(text),
    intelligence: INTELLIGENCE_PATTERNS.test(text),
    trust: TRUST_PATTERNS.test(text)
  };
  const meaningful = checks.userValue || checks.capability || checks.intelligence || checks.trust;
  return {
    meaningful,
    checks,
    verdict: meaningful ? 'MEANINGFUL_FOUNDER_FACING_PROGRESS' : 'NO_MEANINGFUL_FOUNDER_FACING_PROGRESS',
    message: meaningful
      ? 'Meaningful founder-facing progress is supported by at least one value/capability/intelligence/trust signal.'
      : 'No meaningful founder-facing progress.',
    reasons: buildReasons(checks, normalizedItems, text)
  };
}

function formatRealityCheck(progress) {
  if (!progress || !progress.meaningful) return 'Reality check: No meaningful founder-facing progress.';
  return [
    'Reality check:',
    `- User value increased: ${yesNo(progress.checks.userValue)}`,
    `- Capability increased: ${yesNo(progress.checks.capability)}`,
    `- Intelligence increased: ${yesNo(progress.checks.intelligence)}`,
    `- Trust increased: ${yesNo(progress.checks.trust)}`
  ].join('\n');
}

function onlyTheatre(text = '') {
  const value = String(text || '');
  return THEATRE_PATTERNS.test(value) &&
    !VALUE_PATTERNS.test(value) &&
    !CAPABILITY_PATTERNS.test(value) &&
    !INTELLIGENCE_PATTERNS.test(value) &&
    !TRUST_PATTERNS.test(value);
}

function buildReasons(checks, items, text) {
  if (!items.length) return ['No completed work item was supplied.'];
  const reasons = [];
  if (checks.userValue) reasons.push('A user/product value signal is present.');
  if (checks.capability) reasons.push('A capability-enabling signal is present.');
  if (checks.intelligence) reasons.push('An agent intelligence/reasoning signal is present.');
  if (checks.trust) reasons.push('A trust/safety/privacy signal is present.');
  if (!reasons.length && THEATRE_PATTERNS.test(text)) {
    reasons.push('Only report, documentation, cleanup, architecture, or abstraction signals were found.');
  }
  return reasons.length ? reasons : ['No value, capability, intelligence, or trust signal was found.'];
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  evaluateFounderFacingProgress,
  formatRealityCheck
};
