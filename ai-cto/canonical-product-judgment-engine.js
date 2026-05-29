const { containsFounderDoctrine, getFounderDnaCore } = require('./founder-dna-core');

function answerFounderAlignedProductQuestion(message = '', context = {}) {
  const text = String(message || '').toLowerCase();
  if (!containsFounderDoctrine(text)) return null;
  if (isExecutionLike(text)) return null;

  const core = getFounderDnaCore();
  const highestPressure = context.highestPressure || 'typing feel, swipe trust, and compact-layout comfort';

  if (/whatsapp|agents/.test(text)) {
    return answer('whatsapp_agents_founder_dna', [
      'Your WhatsApp agents should now treat MyKeyboard/ai-cto as the canonical brain.',
      'The absorbed doctrine is: conversation first, execution only when explicit, and product trust above architecture.',
      'What still stays strict: preservation mode, mutation approval, hot-path protection, privacy boundaries, and runtime path stability.',
      'Best test now: ask product questions naturally and confirm they answer from typing trust instead of opening FIX/report loops.'
    ]);
  }

  if (/what.*(improve|next)|should.*improve|highest.*pressure/.test(text)) {
    return answer('phase1_priority_judgment', [
      `I would start from ${highestPressure}, not architecture cleanup.`,
      `Founder DNA rule: ${core.hierarchy[0]}, ${core.hierarchy[1]}, ${core.hierarchy[3]}.`,
      'Safe next move: inspect evidence first, propose one reversible Phase 1 experiment, then wait for approval before touching protected runtime.'
    ]);
  }

  if (/not change|avoid|should.*not/.test(text)) {
    return answer('calm_stability_judgment', [
      'I would avoid changing prediction aggressiveness, spacing muscle memory, or swipe thresholds without stronger evidence.',
      'The safer product move is to protect rhythm first, then adjust one small variable only when recurring friction proves it matters.',
      'Mature keyboards avoid surprising users during normal typing.'
    ]);
  }

  if (/gboard|swiftkey|mature|immature|polished/.test(text)) {
    return answer('mature_keyboard_comparison', [
      'Compared with mature keyboards, the main risk is not feature count; it is whether spacing, correction, swipe confidence, and visual calmness feel inevitable.',
      'Aritenis should improve by reducing hesitation and fatigue, not by adding visible intelligence.',
      'Evidence should come from Product Lab screenshots, scripted typing flows, and repeated friction patterns.'
    ]);
  }

  if (/privacy|leak|data|raw text|typed text/.test(text)) {
    return answer('privacy_trust_judgment', [
      'Privacy is a Phase 1 trust feature.',
      'The system should not claim privacy-safe unless dataflow, screenshots, WhatsApp summaries, GitHub artifacts, datasets, and logs are verified.',
      'Founder DNA rule: local-first must be provable, not branding.'
    ]);
  }

  if (/architecture|rewrite|modern|future-proof|sophistication/.test(text)) {
    return answer('anti_vanity_judgment', [
      'I would not prioritize architecture cleanup unless it clearly improves retention, typing trust, or rollback safety.',
      'Architecture work ranks below typing feel, swipe trust, responsiveness, correction burden, and symbol ergonomics.',
      'If the evidence is weak, no change is safer.'
    ]);
  }

  if (/stable|no change|do nothing|wait/.test(text)) {
    return answer('stability_judgment', [
      'No change is a valid product decision when evidence is weak or the patch touches muscle memory.',
      'The keyboard should mature slowly through tiny, reversible improvements.',
      'Stability wins unless there is a clear Phase 1 trust or retention gain.'
    ]);
  }

  if (/feel|friction|annoy|fatigue|tense|cramped|rhythm|comfort/.test(text)) {
    return answer('typing_feel_judgment', [
      'I would judge this by typing rhythm, thumb confidence, correction calmness, visual density, and long-session fatigue.',
      'Subtle annoyance matters because users often leave keyboards silently.',
      'The safest path is screenshot evidence plus one bounded UX experiment, not a broad rewrite.'
    ]);
  }

  return answer('founder_dna_product_discussion', [
    `I would reason from the core doctrine: ${core.productNorthStar}`,
    'The safest answer should prefer trust, retention, stability, evidence, and product safety before intelligence or sophistication.',
    'For product discussion, I would stay calm, compare against real keyboard feel, and avoid turning conversation into a workflow.'
  ]);
}

function isExecutionLike(text) {
  return /\b(fix|execute|implement|commit|push|modify|edit|write|delete|create file|apply patch|build now|ota build)\b/.test(text);
}

function answer(command, lines) {
  return {
    command,
    details: { agent: 'cto', intent: command, founderDnaAbsorbed: true },
    matchedRoute: 'founder_dna_product_judgment',
    response: lines.join('\n')
  };
}

module.exports = { answerFounderAlignedProductQuestion };
