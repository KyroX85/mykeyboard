function classifyFounderIntent(input = '', context = {}) {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return clarify('Empty request.');

  const noise = [
    'quantum banana',
    'banana quantum potato',
    'purple engine cat explosion'
  ];
  const ambiguous = [
    'do the thing',
    'make it smarter',
    'improve everything'
  ];
  if (ambiguous.includes(text)) {
    return clarify('Ambiguous shorthand without target subsystem or success condition.');
  }

  if (noise.includes(text) || looksRandom(text)) {
    return noiseSignal('Stress-test or invalid input signal; not an engineering task.');
  }

  if (text === 'rewrite system' || /\brewrite everything\b/.test(text)) {
    return safetyBlock('Broad rewrite request without evidence or bounded rollback plan.');
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const hasAction = /\b(fix|update|test|validate|measure|reduce|stabilize|improve|analyze|report|block|protect|make|create|remove|delete)\b/.test(text);
  const hasTarget = /\b(keyboard|swipe|typing|latency|symbol|predictor|governance|report|test|file|module)\b/.test(text);
  if (tokens.length < 3 || !hasAction || !hasTarget) {
    return clarify('Missing concrete action and subsystem context.');
  }

  if (isRepeatedNoise(text, context)) {
    return noiseSignal('Repeated non-actionable validation input.');
  }

  return {
    lowInformation: false,
    intentClass: 'REAL_ENGINEERING_REQUEST',
    executionMode: 'EXECUTE_OR_PROPOSE',
    response: null
  };
}

function detectLowInformation(input = '', context = {}) {
  const classified = classifyFounderIntent(input, context);
  return {
    ...classified,
    lowInformation: classified.executionMode !== 'EXECUTE_OR_PROPOSE'
  };
}

function noiseSignal(reason) {
  return {
    lowInformation: true,
    intentClass: 'STRESS_TEST_OR_NOISE',
    executionMode: 'IGNORE_NOISE',
    reason,
    response: [
      'NOISE / STRESS TEST DETECTED.',
      'Intent: validation input, not an engineering task.',
      'Action: no execution started. No FIX loop opened.',
      'State: continuing monitoring mode.'
    ].join('\n')
  };
}

function clarify(reason) {
  return {
    lowInformation: true,
    intentClass: 'AMBIGUOUS_INSTRUCTION',
    executionMode: 'CLARIFY',
    reason,
    response: [
      'AMBIGUOUS INTENT DETECTED.',
      reason,
      'Action: no mutation started.',
      'Needed: target subsystem, desired outcome, and evidence or acceptance criteria.'
    ].join('\n')
  };
}

function safetyBlock(reason) {
  return {
    lowInformation: true,
    intentClass: 'UNSAFE_MUTATION_REQUEST',
    executionMode: 'SAFETY_BLOCK',
    reason,
    response: [
      'SAFETY BLOCK.',
      reason,
      'Action: no execution started.',
      'Reason: stability and rollback confidence are insufficient.'
    ].join('\n')
  };
}

function low(reason) {
  return clarify(reason);
}

function looksRandom(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return false;
  const engineeringWords = /\b(keyboard|swipe|typing|latency|symbol|predictor|governance|report|test|file|module|build|commit|fix|improve|analyze)\b/;
  const actionWords = /\b(fix|update|test|validate|measure|reduce|stabilize|improve|analyze|report|block|protect|make|create|remove|delete)\b/;
  return !engineeringWords.test(text) && !actionWords.test(text);
}

function isRepeatedNoise(text, context = {}) {
  const recent = Array.isArray(context.recentMessages) ? context.recentMessages : [];
  const matching = recent.filter((entry) => {
    const prior = String(entry.founderMessage || entry.body || entry.summary || entry.text || '').trim().toLowerCase();
    return prior === text;
  });
  return matching.length >= 2;
}

module.exports = { classifyFounderIntent, detectLowInformation };
