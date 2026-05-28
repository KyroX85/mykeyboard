function evaluateFounderTasteAlignment({
  proposal = '',
  evidenceSummary = '',
  visibleBehaviorChange = '',
  addsPersonality = false,
  addsArchitecture = false
} = {}) {
  const text = `${proposal} ${evidenceSummary} ${visibleBehaviorChange}`;
  const values = [];
  if (/\bcalm|comfortable|low[- ]?friction|predictable|stable|small|reversible\b/i.test(text)) values.push('calm');
  if (/\bprivacy|local|no raw|no telemetry\b/i.test(text)) values.push('privacy');
  if (/\bretention|trust|thumb|typing|symbol|swipe|readability|fatigue\b/i.test(text)) values.push('retention');
  const violations = [];
  if (addsPersonality || /\bpersonality|companion|emotional\b/i.test(text)) violations.push('fake emotional behavior');
  if (addsArchitecture || /\barchitecture|framework|multi-agent|scalable rewrite\b/i.test(text)) violations.push('architecture vanity');
  if (!evidenceSummary) violations.push('missing evidence');
  return {
    aligned: values.length > 0 && violations.length === 0,
    values,
    violations
  };
}

module.exports = { evaluateFounderTasteAlignment };
