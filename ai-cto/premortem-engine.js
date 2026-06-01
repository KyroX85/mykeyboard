const MAX_PREMORTEMS = 30;

function shouldRunPremortem(decision = '', context = {}) {
  const text = decisionText(decision, context).toLowerCase();
  if (!text.trim()) return false;
  if (/\b(hi|hello|thanks|ok bro|how are you|memory audit|status only)\b/.test(text)) return false;
  return /\b(decision|build|create|add|ship|implement|design|rewrite|feature|proposal|should we|what if|phase 2|explain|execution layer|screenshot|prediction|swipe|keyboardservice|hot path|architecture|infrastructure|orchestration|governance|framework)\b/.test(text);
}

function generatePremortem(decision = '', context = {}) {
  const text = decisionText(decision, context).trim();
  const signals = extractSignals(text);
  const decisionClass = classifyDecision(signals);
  const failureModes = unique([
    'Users do not notice the change in a real daily moment.',
    'The decision creates activity but does not increase repeat use.',
    ...classFailureModes(decisionClass)
  ]);
  const blindSpots = unique([
    'Founder excitement may be mistaken for user demand.',
    'Frequency of the user pain may be lower than assumed.',
    'Evidence may be from internal reasoning rather than real product use.',
    ...classBlindSpots(decisionClass)
  ]);
  const executionRisks = unique([
    'Scope expands beyond one reversible decision.',
    'Validation is declared before the changed behavior is observed.',
    ...classExecutionRisks(decisionClass)
  ]);
  const trustRisks = unique([
    'The work may make Aritenis feel heavier if it adds friction before clear value.',
    ...classTrustRisks(decisionClass)
  ]);

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    decision: text.slice(0, 260),
    decisionClass,
    failureModes,
    blindSpots,
    executionRisks,
    trustRisks,
    severity: severityFor(decisionClass),
    recommendation: recommendationFor(decisionClass),
    confidence: confidenceFor(signals, decisionClass)
  };
}

function updatePremortemMemory(existing = {}, premortem = null) {
  const model = normalizePremortemMemory(existing);
  if (!premortem) return model;
  const recentPremortems = [
    premortem,
    ...model.recentPremortems.filter((item) => item.decision !== premortem.decision)
  ].slice(0, MAX_PREMORTEMS);
  return {
    version: '1.0',
    recentPremortems,
    classCounts: countByClass(recentPremortems),
    lastPremortem: premortem,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizePremortemMemory(value = {}) {
  const recentPremortems = Array.isArray(value && value.recentPremortems) ? value.recentPremortems : [];
  return {
    version: '1.0',
    recentPremortems,
    classCounts: value && value.classCounts && typeof value.classCounts === 'object'
      ? value.classCounts
      : countByClass(recentPremortems),
    lastPremortem: value && value.lastPremortem ? value.lastPremortem : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function decisionText(decision, context = {}) {
  return String(
    decision ||
    context.decision ||
    context.idea ||
    context.proposal ||
    context.founderMessage ||
    context.agentAnswer ||
    ''
  );
}

function extractSignals(text = '') {
  const lower = text.toLowerCase();
  return {
    explain: /\b(explain|understand|screenshot|bill|notice|form|document|error|message)\b/.test(lower),
    infrastructure: /\b(infrastructure|architecture|framework|orchestration|governance|report|memory layer|agent system|multi-agent|scalable|modern)\b/.test(lower),
    hotPath: /\b(rewrite|prediction|keyboardservice|hot path|autocorrect|swipe|typing|latency)\b/.test(lower),
    executionLayer: /\b(execution layer|glass handle|liquid glass|action surface)\b/.test(lower),
    explicitDecision: /\b(decision|build|create|ship|implement|design|rewrite|proposal|should we|what if)\b/.test(lower)
  };
}

function classifyDecision(signals) {
  if (signals.hotPath) return 'HOT_PATH_KEYBOARD';
  if (signals.infrastructure) return 'INFRASTRUCTURE_HEAVY';
  if (signals.explain || signals.executionLayer) return 'PHASE2_EXPLAIN';
  return 'GENERAL_PRODUCT_DECISION';
}

function classFailureModes(decisionClass) {
  if (decisionClass === 'PHASE2_EXPLAIN') {
    return [
      'Explain may be useful once but not become a repeat behavior.',
      'The answer quality may feel generic compared with asking a dedicated AI app.',
      'Screenshot capture friction may be higher than the value of the explanation.'
    ];
  }
  if (decisionClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'Infrastructure theater replaces user-facing progress.',
      'Agents feel more elaborate while the product remains unchanged.',
      'The work becomes harder to debug than the value it creates.'
    ];
  }
  if (decisionClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Typing trust regresses even if the change appears smarter.',
      'Prediction or swipe behavior becomes less predictable under daily use.',
      'A small hot-path mistake damages the protected Phase 1 foundation.'
    ];
  }
  return ['The decision may solve an internal concern rather than a user problem.'];
}

function classBlindSpots(decisionClass) {
  if (decisionClass === 'PHASE2_EXPLAIN') {
    return [
      'We may not know which confusing screenshots happen often enough.',
      'We may assume users want explanations inside the keyboard before seeing permission friction.'
    ];
  }
  if (decisionClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'We may be optimizing agent sophistication instead of user leverage.',
      'We may ignore that users cannot feel better orchestration directly.'
    ];
  }
  if (decisionClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Local tests may miss long-session typing fatigue.',
      'Founder-visible improvement may hide regressions on smaller devices.'
    ];
  }
  return ['The decision may lack a clear before/after user-value measure.'];
}

function classExecutionRisks(decisionClass) {
  if (decisionClass === 'PHASE2_EXPLAIN') {
    return [
      'Screenshot permissions and privacy handling may delay a usable prototype.',
      'The wedge may expand into chat behavior before the action surface is proven.'
    ];
  }
  if (decisionClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'Implementation may create more files, reports, and routes without improving the product.',
      'Multiple agents may disagree because the decision increases routing surface area.'
    ];
  }
  if (decisionClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Hot path regression may be hard to rollback if multiple files change together.',
      'Validation may require real keyboard feel testing, not only unit tests.'
    ];
  }
  return ['Rollback may be unclear if the decision touches multiple subsystems.'];
}

function classTrustRisks(decisionClass) {
  if (decisionClass === 'PHASE2_EXPLAIN') {
    return [
      'Screenshots may contain private content, so retention and upload rules must be explicit.',
      'If Explain feels slow or wrong, users may trust the keyboard less during real conversations.'
    ];
  }
  if (decisionClass === 'INFRASTRUCTURE_HEAVY') {
    return [
      'Founder trust drops if the system reports progress that users cannot feel.',
      'More automation may create the appearance of autonomy without product judgment.'
    ];
  }
  if (decisionClass === 'HOT_PATH_KEYBOARD') {
    return [
      'Prediction, latency, or correction regressions can directly damage typing trust.',
      'Users may silently leave if the keyboard feels less predictable.'
    ];
  }
  return ['Trust may fall if the decision is framed as progress without evidence.'];
}

function severityFor(decisionClass) {
  if (decisionClass === 'HOT_PATH_KEYBOARD') return 'HIGH';
  if (decisionClass === 'INFRASTRUCTURE_HEAVY') return 'MEDIUM_HIGH';
  if (decisionClass === 'PHASE2_EXPLAIN') return 'MEDIUM';
  return 'MEDIUM';
}

function recommendationFor(decisionClass) {
  if (decisionClass === 'PHASE2_EXPLAIN') {
    return 'Proceed only as a bounded user-visible experiment with explicit privacy handling and proof that users need this moment often.';
  }
  if (decisionClass === 'INFRASTRUCTURE_HEAVY') {
    return 'Do not prioritize until it is converted into a user-visible outcome with clear leverage.';
  }
  if (decisionClass === 'HOT_PATH_KEYBOARD') {
    return 'Require strong evidence, tiny scope, screenshot or feel validation where relevant, and an easy rollback before touching the protected foundation.';
  }
  return 'Clarify user pain, evidence, and rollback before treating this as a major decision.';
}

function confidenceFor(signals, decisionClass) {
  const signalCount = ['explain', 'infrastructure', 'hotPath', 'executionLayer', 'explicitDecision']
    .filter((key) => signals[key]).length;
  const base = decisionClass === 'GENERAL_PRODUCT_DECISION' ? 55 : 66;
  return clamp(base + signalCount * 5, 50, 88);
}

function countByClass(items = []) {
  return items.reduce((counts, item) => {
    const key = item && item.decisionClass ? item.decisionClass : 'UNKNOWN';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  shouldRunPremortem,
  generatePremortem,
  updatePremortemMemory,
  normalizePremortemMemory
};
