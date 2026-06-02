const MAX_PRINCIPLES = 20;

function extractPrinciplesFromFeedback(feedback = []) {
  const items = array(feedback);
  const text = items.map(feedbackText).join(' ').toLowerCase();
  const principles = [];

  if (countMatches(text, [/generic/, /status|health|momentum|cto mode|report/, /task[_\s-]?plan|execution plan|approve|files|validation/]) >= 2) {
    principles.push(principle({
      id: 'strategic_truth_over_operational_reporting',
      principle: 'Founder values strategic truth over operational reporting.',
      evidence: evidenceFor(items, /generic|status|health|momentum|cto mode|task[_\s-]?plan|execution plan|report|files|validation/i),
      responseRule: 'Answer the strategic truth first; remove health, momentum, task-plan, and generic CTO framing unless explicitly requested.',
      confidence: 86
    }));
  }

  if (countMatches(text, [/not[_\s-]?relevant|didn t answer|not what i asked/, /wrong|bad answer|incorrect/, /generic|vague|status|health|momentum|task[_\s-]?plan|execution plan/]) >= 2) {
    principles.push(principle({
      id: 'founder_objective_before_formatting',
      principle: 'Answer the founder objective before formatting or workflow language.',
      evidence: evidenceFor(items, /not[_\s-]?relevant|wrong|bad answer|generic|vague|didn.?t answer|not what i asked/i),
      responseRule: 'Reconstruct the founder question and answer it directly before adding labels, reports, or next steps.',
      confidence: 84
    }));
  }

  if (countMatches(text, [/user value|user proof|users care|useful|habit|leverage/, /too philosophical|abstract|theoretical/, /too tactical|implementation/]) >= 2) {
    principles.push(principle({
      id: 'user_leverage_over_abstraction',
      principle: 'Founder values user leverage over abstraction or implementation detail.',
      evidence: evidenceFor(items, /user value|user proof|users care|useful|habit|leverage|philosophical|abstract|tactical|implementation/i),
      responseRule: 'Ground the answer in what users notice, care about, return for, or would miss.',
      confidence: 82
    }));
  }

  return principles;
}

function updatePrincipleMemory(existing = {}, feedback = []) {
  const memory = normalizePrincipleMemory(existing);
  const incoming = extractPrinciplesFromFeedback(feedback);
  if (!incoming.length) return memory;
  const merged = [...incoming, ...memory.principles];
  const seen = new Set();
  const principles = [];
  for (const item of merged) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    principles.push(item);
    if (principles.length >= MAX_PRINCIPLES) break;
  }
  return {
    version: '1.0',
    principles,
    lastPrinciple: principles[0] || null,
    lastUpdatedAt: new Date().toISOString()
  };
}

function applyFounderPrinciplesToResponse(response = '', context = {}) {
  const memory = normalizePrincipleMemory(context.memory && context.memory.founderPrinciples);
  if (!memory.principles.length) return response;
  const active = memory.principles[0];
  let output = String(response || '');

  if (hasPrinciple(memory, 'strategic_truth_over_operational_reporting')) {
    output = output
      .split(/\r?\n/)
      .filter((line) => !/^(Current Foundation Health|Health\s*:|Momentum\s*:|TASK_PLAN|Task Plan|Execution Plan|APPROVE|Files:|Validation:|Recommended Next Step|Phase 2 Opportunities|Trust Risk:)/i.test(line.trim()))
      .join('\n')
      .trim();
  }

  if (!output) output = 'The useful answer is the founder objective, not a status template.';
  const line = `Founder principle applied: ${active.principle}`;
  if (!output.includes(line)) output = [output, '', line].filter(Boolean).join('\n');
  return output;
}

function formatPrinciplesForResponse(memory = {}) {
  const normalized = normalizePrincipleMemory(memory);
  if (!normalized.principles.length) return '';
  return [
    'Founder principles:',
    ...normalized.principles.slice(0, 3).map((item) => `- ${item.principle}`)
  ].join('\n');
}

function normalizePrincipleMemory(value = {}) {
  return {
    version: '1.0',
    principles: Array.isArray(value && value.principles) ? value.principles : [],
    lastPrinciple: value && value.lastPrinciple ? value.lastPrinciple : null,
    lastUpdatedAt: value && value.lastUpdatedAt ? value.lastUpdatedAt : null
  };
}

function principle({ id, principle, evidence = [], responseRule, confidence }) {
  return {
    id,
    principle,
    evidence: evidence.slice(0, 5),
    responseRule,
    confidence: Math.min(90, Math.max(0, confidence || 70)),
    extractedAt: new Date().toISOString()
  };
}

function evidenceFor(items = [], pattern) {
  return array(items)
    .filter((item) => pattern.test(feedbackText(item)))
    .map((item) => clean(`${item.feedback || item.polarity || 'feedback'}: ${item.answerPattern || item.rawAnswerPreview || item.adaptation || item.sourceMessage || ''}`))
    .filter(Boolean)
    .slice(0, 5);
}

function hasPrinciple(memory = {}, id = '') {
  return array(memory.principles).some((item) => item.id === id);
}

function countMatches(text = '', patterns = []) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function feedbackText(item = {}) {
  return [
    item.feedback,
    item.polarity,
    item.adaptation,
    item.answerPattern,
    item.rawAnswerPreview,
    item.failureReason,
    item.successReason,
    item.sourceMessage
  ].filter(Boolean).join(' ');
}

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  extractPrinciplesFromFeedback,
  updatePrincipleMemory,
  applyFounderPrinciplesToResponse,
  formatPrinciplesForResponse,
  normalizePrincipleMemory
};
