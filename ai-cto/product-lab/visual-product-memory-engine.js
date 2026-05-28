const fs = require('fs');
const path = require('path');
const { classifyVisualFriction } = require('./visual-friction-engine');

const FILE = 'visual-product-memory.json';

function loadVisualProductMemory(root = process.cwd()) {
  const file = path.join(root, FILE);
  if (!fs.existsSync(file)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return empty();
  }
}

function updateVisualProductMemory({ root = process.cwd(), screenshotEvidence = {}, cycleId = '' } = {}) {
  const memory = loadVisualProductMemory(root);
  const visual = classifyVisualFriction(screenshotEvidence);
  const cycle = {
    id: cycleId || screenshotEvidence.id || `cycle-${memory.cycles.length + 1}`,
    capturedAt: screenshotEvidence.capturedAt || new Date().toISOString(),
    findings: visual.findings.map((finding) => ({
      type: finding.type,
      severity: finding.severity,
      message: finding.message
    })),
    metrics: screenshotEvidence.candidate || {}
  };

  memory.cycles = appendCycle(memory.cycles, cycle);
  memory.recurringIssues = buildRecurringIssues(memory.cycles);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(memory, null, 2));
  return memory;
}

function buildRecurringIssues(cycles = []) {
  const counts = new Map();
  for (const cycle of cycles) {
    for (const finding of cycle.findings || []) {
      const current = counts.get(finding.type) || { issue: finding.type, count: 0, severity: finding.severity, messages: [] };
      current.count += 1;
      current.severity = strongestSeverity(current.severity, finding.severity);
      current.messages = [...new Set([...current.messages, finding.message])].slice(-5);
      counts.set(finding.type, current);
    }
  }
  return [...counts.values()].sort((a, b) =>
    b.count - a.count ||
    issuePriority(a.issue) - issuePriority(b.issue) ||
    severityScore(b.severity) - severityScore(a.severity)
  );
}

function appendCycle(cycles, cycle) {
  return [...(Array.isArray(cycles) ? cycles : []), cycle].slice(-90);
}

function strongestSeverity(a, b) {
  return severityScore(b) > severityScore(a) ? b : a;
}

function severityScore(value) {
  return { HIGH: 3, MEDIUM: 2, LOW: 1 }[value] || 0;
}

function issuePriority(issue) {
  return {
    'cramped-spacing': 0,
    'edge-key-risk': 1,
    'symbol-friction': 2,
    'dark-mode-contrast': 3,
    'overlap-risk': 4
  }[issue] ?? 9;
}

function empty() {
  return {
    version: '1.0',
    updatedAt: null,
    cycles: [],
    recurringIssues: []
  };
}

module.exports = {
  loadVisualProductMemory,
  updateVisualProductMemory,
  buildRecurringIssues
};
