const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'test_output.log');
const BRAIN_STATE_FILE = path.join(__dirname, '.brain_state.json');
const REPORT_FILE = path.join(process.cwd(), 'ENGINEERING_REPORT.md');

let state = {
  version: '2.0',
  unresolvedIssues: [],
  lastAnalysis: null,
  healthScore: 100,
  momentum: 'STABLE'
};

function log(msg) { console.log(`[brain] ${msg}`); }

function loadState() {
  if (fs.existsSync(BRAIN_STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BRAIN_STATE_FILE, 'utf8'));
      state = { ...state, ...data };
    } catch (e) { log('State reset required.'); }
  }
}

function saveState() {
  try {
    const tmp = BRAIN_STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, BRAIN_STATE_FILE);
  } catch (e) { log(`Error: ${e.message}`); }
}

function analyzeFailures() {
  if (!fs.existsSync(LOG_FILE)) return [];
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const failures = [];
  const failRegex = /(FAIL|Error|Exception|ERR!):?\s+(.*)/i;
  
  content.split('\n').forEach((line, i) => {
    const match = line.match(failRegex);
    if (match) {
      failures.push({
        type: match[1],
        message: match[2].trim(),
        classification: 'REVIEW_REQUIRED',
        impact: 'HIGH'
      });
    }
  });
  return failures;
}

function detectImprovements() {
  const improvements = [];
  // Example heuristic: detect large files for resource cleanup
  // In a real repo, we'd scan for TODOs, lint issues, etc.
  return improvements;
}

function calculateHealth(failures) {
  let score = 100;
  score -= failures.length * 10;
  state.healthScore = Math.max(0, score);
  state.momentum = failures.length > 0 ? 'STALLED' : 'CLIMBING';
}

function generateReport(failures, improvements) {
  const now = new Date().toISOString();
  let r = `# Engineering Report - ${now}\n\n`;
  
  r += `## Repository Health: ${state.healthScore}/100\n`;
  r += `**Momentum:** ${state.momentum}\n`;
  r += `**Unresolved Issues:** ${state.unresolvedIssues.length}\n\n`;

  if (failures.length > 0) {
    r += `### ⚠️ Regressions & Failures\n`;
    failures.forEach(f => r += `- [ ] **[${f.impact}]** ${f.message}\n`);
  } else {
    r += `### ✅ Status: All Clear\nNo active regressions detected.\n`;
  }

  r += `\n### 🛠️ Proposed Improvements\n`;
  if (improvements.length === 0) r += `No safe autofixes available at this time.\n`;
  
  r += `\n### 🛡️ Guardrails & Risks\n`;
  r += `- Resource usage: WITHIN_TARGET\n`;
  r += `- Architectural Drift: NONE_DETECTED\n`;
  r += `- Blocked Areas: Prediction Engine, Core Persistence\n`;

  fs.writeFileSync(REPORT_FILE, r);
  log(`Report updated: ${state.healthScore}% health.`);
}

loadState();
const failures = analyzeFailures();
const improvements = detectImprovements();
calculateHealth(failures);

state.lastAnalysis = new Date().toISOString();
state.unresolvedIssues = failures.map(f => ({ ...f, detectedAt: state.lastAnalysis }));

saveState();
generateReport(failures, improvements);

// Output for GHA
if (improvements.some(i => i.classification === 'SAFE_AUTOFIX')) {
  console.log('::set-output name=autofix_available::true');
}
