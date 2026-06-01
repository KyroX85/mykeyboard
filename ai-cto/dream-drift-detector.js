const { DREAM_MODEL, buildDreamAlignment } = require('./dream-model');

const MAX_DRIFT_CHECKS = 50;
const DRIFT_ALERT_THRESHOLD = 65;

function detectDreamDrift(currentWork = '', context = {}) {
  const text = String(currentWork || '').trim();
  const signals = extractDriftSignals(text);
  const alignment = buildDreamAlignment({
    question: text,
    root: context.root,
    memoryLayer: context.founderMemoryLayer
  });
  const alignmentScore = calculateAlignmentScore(signals);
  const driftScore = calculateDriftScore(signals, alignmentScore);
  const classification = classifyDrift(driftScore, alignmentScore);

  return {
    timestamp: new Date().toISOString(),
    currentWork: text.slice(0, 280),
    founderDream: DREAM_MODEL.longTermVision,
    activeBridge: DREAM_MODEL.activeBridge,
    projectGoal: alignment.projectGoal,
    alignmentScore,
    driftScore,
    classification,
    alert: classification === 'DRIFTING_AWAY',
    reason: reasonFor(signals, classification),
    evidence: evidenceFor(signals),
    recommendation: recommendationFor(classification),
    confidence: confidenceFor(signals)
  };
}

function applyDreamDriftToRoute(route = {}, { message = '', context = {} } = {}) {
  if (!route || !route.response || !shouldApplyToRoute(route)) return route;
  if (!shouldEvaluateDreamDrift(message)) return route;

  const drift = detectDreamDrift(message, context);
  const details = {
    ...(route.details || {}),
    dreamDrift: drift
  };

  if (!drift.alert) {
    return {
      ...route,
      details
    };
  }

  return {
    ...route,
    details,
    response: appendDreamDriftAlert(route.response, drift)
  };
}

function updateDreamDriftMemory(existing = {}, drift = null) {
  const model = normalizeDreamDriftMemory(existing);
  if (!drift) return model;
  const recentDriftChecks = [
    drift,
    ...model.recentDriftChecks.filter((item) => item.currentWork !== drift.currentWork)
  ].slice(0, MAX_DRIFT_CHECKS);
  const driftAlerts = recentDriftChecks.filter((item) => item.alert);
  return {
    version: '1.0',
    recentDriftChecks,
    driftAlertCount: driftAlerts.length,
    alignedCount: recentDriftChecks.filter((item) => item.classification === 'ALIGNED').length,
    lastDriftAlert: driftAlerts[0] || model.lastDriftAlert || null,
    lastCheck: drift,
    lastUpdatedAt: new Date().toISOString()
  };
}

function normalizeDreamDriftMemory(value = {}) {
  return {
    version: '1.0',
    recentDriftChecks: Array.isArray(value && value.recentDriftChecks) ? value.recentDriftChecks : [],
    driftAlertCount: Number.isFinite(value && value.driftAlertCount) ? value.driftAlertCount : 0,
    alignedCount: Number.isFinite(value && value.alignedCount) ? value.alignedCount : 0,
    lastDriftAlert: value && value.lastDriftAlert ? value.lastDriftAlert : null,
    lastCheck: value && value.lastCheck ? value.lastCheck : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function shouldEvaluateDreamDrift(text = '') {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) return false;
  if (/\b(hi|thanks|ok|latest screenshot|capture screenshot|build now|scan now)\b/.test(value)) return false;
  return /\b(should we|what if|focus|build|create|add|feature|roadmap|dream|vision|wrong thing|instead of|next month|next quarter|strategy|users?|product)\b/.test(value);
}

function shouldApplyToRoute(route = {}) {
  const command = String(route.command || route.details && route.details.intent || '');
  if (/\b(build|scan|screenshot|commit|push|approval|approve|execution|preservation|product_lab)\b/i.test(command)) {
    return false;
  }
  const details = route.details || {};
  if (details.skipDreamDriftDetector) return false;
  return true;
}

function extractDriftSignals(text = '') {
  const value = String(text || '').toLowerCase();
  return {
    explain: /\b(explain|understand|screenshot|confusing|bill|notice|form|document|error|message)\b/.test(value),
    userLeverage: /\b(user|users|daily|return|pay|care|useful|outcome|leverage|workflow|complete action)\b/.test(value),
    trust: /\b(trust|privacy|local|safe|typing|keyboard|swipe|latency|stability)\b/.test(value),
    phoneNative: /\b(phone|whatsapp|keyboard|screenshot|app|mobile)\b/.test(value),
    infrastructure: /\b(infrastructure|architecture|governance|report|memory layer|agent system|orchestration|framework|scalable|modern)\b/.test(value),
    vanity: /\b(impressive|sophisticated|future-proof|advanced|multi-agent|ai os|agi|autonomous)\b/.test(value),
    gboardClone: /\b(prediction|themes|settings|better swipe|better autocorrect|gboard clone)\b/.test(value),
    unsafeAutonomy: /\b(auto-send|silent control|collect raw|cloud telemetry|store screenshots forever|emotional companion)\b/.test(value),
    replacingExplain: /\b(instead of explain|only on execution layer|focus only on execution|instead of users|instead of user)\b/.test(value)
  };
}

function calculateAlignmentScore(signals) {
  let score = 35;
  if (signals.explain) score += 25;
  if (signals.userLeverage) score += 18;
  if (signals.trust) score += 16;
  if (signals.phoneNative) score += 10;
  if (signals.infrastructure && !signals.userLeverage) score -= 22;
  if (signals.vanity) score -= 18;
  if (signals.gboardClone) score -= 14;
  if (signals.unsafeAutonomy) score -= 35;
  if (signals.replacingExplain) score -= 30;
  return clamp(score, 0, 100);
}

function calculateDriftScore(signals, alignmentScore) {
  let score = 100 - alignmentScore;
  if (signals.infrastructure && !signals.userLeverage) score += 25;
  if (signals.vanity) score += 18;
  if (signals.gboardClone) score += 15;
  if (signals.unsafeAutonomy) score += 35;
  if (signals.replacingExplain) score += 30;
  if (signals.explain && signals.trust) score -= 20;
  return clamp(score, 0, 100);
}

function classifyDrift(driftScore, alignmentScore) {
  if (driftScore >= DRIFT_ALERT_THRESHOLD && alignmentScore < 55) return 'DRIFTING_AWAY';
  if (alignmentScore >= 65) return 'ALIGNED';
  return 'WATCH';
}

function evidenceFor(signals) {
  const evidence = [];
  if (signals.explain) evidence.push('ties to Explain or understanding-before-typing');
  if (signals.userLeverage) evidence.push('mentions user-visible leverage or return behavior');
  if (signals.trust) evidence.push('protects trust/privacy/keyboard foundation');
  if (signals.phoneNative) evidence.push('fits phone-native keyboard/screenshot context');
  if (signals.infrastructure) evidence.push('infrastructure/orchestration is not directly user-visible');
  if (signals.vanity) evidence.push('sounds impressive without proving user value');
  if (signals.gboardClone) evidence.push('risks sliding back into Gboard-clone foundation work');
  if (signals.unsafeAutonomy) evidence.push('conflicts with privacy or confirmation-before-action boundaries');
  if (signals.replacingExplain) evidence.push('moves attention away from the active Explain bridge');
  return evidence.length ? evidence : ['no strong dream-alignment signal'];
}

function reasonFor(signals, classification) {
  if (classification === 'ALIGNED') {
    return 'Current work stays connected to Explain, user leverage, or protected trust.';
  }
  if (signals.unsafeAutonomy) return 'It crosses privacy or control boundaries that would damage the trusted intelligence-layer dream.';
  if (signals.replacingExplain) return 'It shifts attention away from Explain, the active bridge toward the founder dream.';
  if (signals.infrastructure || signals.vanity) return 'It emphasizes infrastructure, orchestration, or impressive systems more than user-visible understanding.';
  if (signals.gboardClone) return 'It risks returning to foundation keyboard competition instead of differentiation.';
  return 'The connection to the founder dream is weak or unproven.';
}

function recommendationFor(classification) {
  if (classification === 'ALIGNED') {
    return 'Continue only as a bounded proposal that protects Phase 1 trust.';
  }
  if (classification === 'WATCH') {
    return 'Do not execute yet. Clarify how this advances Explain, user leverage, or phone-native understanding.';
  }
  return 'Pause this direction unless it can be reframed into user-visible Explain leverage with privacy and trust preserved.';
}

function confidenceFor(signals) {
  const count = Object.values(signals).filter(Boolean).length;
  return clamp(50 + count * 7, 50, 90);
}

function appendDreamDriftAlert(response = '', drift = {}) {
  if (String(response || '').includes('Dream drift alert:')) return response;
  return [
    response,
    '',
    `Dream drift alert: this may move Aritenis away from the founder dream.`,
    `Founder dream: ${drift.founderDream}`,
    `Current drift: ${drift.reason}`,
    `Recommendation: ${drift.recommendation}`
  ].join('\n');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  DRIFT_ALERT_THRESHOLD,
  detectDreamDrift,
  applyDreamDriftToRoute,
  updateDreamDriftMemory,
  normalizeDreamDriftMemory,
  shouldEvaluateDreamDrift
};
