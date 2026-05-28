function detectLowInformation(input = '') {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return low('Empty request.');
  const vague = [
    'do the thing',
    'make it smarter',
    'improve everything',
    'rewrite system',
    'quantum banana',
    'banana quantum potato',
    'purple engine cat explosion'
  ];
  if (vague.includes(text)) return low('Request matches known low-information pattern.');
  const tokens = text.split(/\s+/).filter(Boolean);
  const hasAction = /\b(fix|update|test|validate|measure|reduce|stabilize|improve|analyze|report|block|protect|make|create|remove|delete)\b/.test(text);
  const hasTarget = /\b(keyboard|swipe|typing|latency|symbol|predictor|governance|report|test|file|module)\b/.test(text);
  if (tokens.length < 3 || !hasAction || !hasTarget) {
    return low('Missing concrete action and subsystem context.');
  }
  return {
    lowInformation: false,
    response: null
  };
}

function low(reason) {
  return {
    lowInformation: true,
    reason,
    response: [
      'LOW INFORMATION DETECTED.',
      'Not enough actionable product or engineering context.',
      '',
      'Options:',
      '1. Clarify the request',
      '2. Provide a concrete engineering task',
      '3. Cancel'
    ].join('\n')
  };
}

module.exports = { detectLowInformation };
