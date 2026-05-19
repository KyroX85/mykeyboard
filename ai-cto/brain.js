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
  const failRegex = /(FAIL|Error|Exception|ERR!|failed|critical):?\s+(.*)/i;
  
  content.split('\n').forEach((line, i) => {
    const match = line.match(failRegex);
    if (match) {
      failures.push({
        type: match[1].toUpperCase(),
        message: match[2].trim(),
        classification: 'REVIEW_REQUIRED',
        impact: 'CRITICAL',
        source: 'TEST_LOG'
      });
    }
  });
  return failures;
}

function deepCodeScan(dir, scanResults = []) {
  if (shouldIgnore(dir)) return scanResults;
  
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      
      if (stat.isDirectory()) {
        deepCodeScan(full, scanResults);
      } else if (f.endsWith('.js') || f.endsWith('.py') || f.endsWith('.kt')) {
        const code = fs.readFileSync(full, 'utf8');
        const codeWithoutComments = code
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        
        // 1. Hardcoded Secrets Scan
        if (/(?:key|password|secret|token|auth)[a-z0-9_]*\s*[:=]\s*['"][a-zA-Z0-9_\-\s]{10,}['"]/i.test(code)) {
          scanResults.push({ type: 'SECURITY', message: `Hardcoded Secret in ${f}`, impact: 'CRITICAL' });
        }
        
        // 2. Large File Scan (Complexity)
        if (code.split('\n').length > 500) {
          scanResults.push({ type: 'COMPLEXITY', message: `File ${f} is too large (>500 lines)`, impact: 'MEDIUM' });
        }

        // 3. Missing Error Handling
        if (codeWithoutComments.includes('try {') && !/\bcatch\b/.test(codeWithoutComments)) {
          scanResults.push({ type: 'ARCHITECTURE', message: `Unsafe Try Block in ${f}`, impact: 'HIGH' });
        }

        // 4. Console.log in production code
        if (code.includes('console.log(') && !f.includes('test') && !f.includes('watcher')) {
          scanResults.push({ type: 'CODE_SMELL', message: `Production console.log found in ${f}`, impact: 'LOW' });
        }
      }
    }
  } catch (e) {}
  return scanResults;
}

function shouldIgnore(p) {
  const normalized = p.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return ['.git', 'node_modules', 'dist', 'build', 'ai-cto'].some(ignored => parts.includes(ignored));
}

function calculateHealth(failures, scanResults) {
  let score = 100;
  
  // Deduct for test failures
  score -= failures.length * 15;
  
  // Deduct for deep scan issues
  scanResults.forEach(issue => {
    if (issue.impact === 'CRITICAL') score -= 25;
    else if (issue.impact === 'HIGH') score -= 15;
    else if (issue.impact === 'MEDIUM') score -= 5;
    else score -= 2;
  });

  state.healthScore = Math.max(0, score);
  state.momentum = state.healthScore < 70 ? 'STALLED' : (state.healthScore < 90 ? 'RECOVERING' : 'CLIMBING');
}

function generateReport(failures, scanResults) {
  const now = new Date().toISOString();
  let r = `ENGINEERING STATUS REPORT [BRUTAL MODE]\n`;
  r += `DATE: ${now}\n`;
  r += `HEALTH SCORE: ${state.healthScore}/100\n`;
  r += `MOMENTUM: ${state.momentum}\n`;
  r += `-------------------------------------------\n\n`;

  if (failures.length > 0) {
    r += `[!!!] CRITICAL REGRESSIONS DETECTED:\n`;
    failures.forEach(f => r += `- ${f.type}: ${f.message}\n`);
    r += `\n`;
  }

  const criticalScan = scanResults.filter(s => s.impact === 'CRITICAL');
  if (criticalScan.length > 0) {
    r += `[!!!] ARCHITECTURAL RISKS (DEEP SCAN):\n`;
    criticalScan.forEach(s => r += `- ${s.type}: ${s.message}\n`);
    r += `\n`;
  }

  const otherScan = scanResults.filter(s => s.impact !== 'CRITICAL');
  if (otherScan.length > 0) {
    r += `[*] TECHNICAL DEBT & IMPROVEMENTS:\n`;
    otherScan.forEach(s => r += `- [${s.impact}] ${s.message}\n`);
    r += `\n`;
  }

  if (failures.length === 0 && scanResults.length === 0) {
    r += `NO ISSUES DETECTED. SYSTEM IS OPTIMAL.\n`;
  }

  r += `\nGUARDRAILS: Prediction Engine LOCKED, Storage LOCKED.\n`;
  
  fs.writeFileSync(REPORT_FILE, r);
  log(`Brutal analysis complete: ${state.healthScore}% health.`);
}

loadState();
const failures = analyzeFailures();
const scanResults = deepCodeScan(process.cwd());
calculateHealth(failures, scanResults);

state.lastAnalysis = new Date().toISOString();
state.unresolvedIssues = [...failures, ...scanResults].map(i => ({ ...i, detectedAt: state.lastAnalysis }));

saveState();
generateReport(failures, scanResults);
