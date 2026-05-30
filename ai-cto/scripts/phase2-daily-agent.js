const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PLAN_FILE = path.join(ROOT, 'ai-cto', 'phase2-daily-agent-plan.json');
const REPORT_FILE = path.join(ROOT, 'PHASE2_DAILY_AGENT_REPORT.md');

function runPhase2DailyAgent({ root = ROOT, now = new Date(), writeReport = true } = {}) {
  const plan = readJson(path.join(root, 'ai-cto', 'phase2-daily-agent-plan.json'), {});
  const roadmap = readJson(path.join(root, 'ai-cto', 'roadmap-lock.json'), {});
  const evidence = collectDailyEvidence(root);
  const task = selectDailyTask({ plan, roadmap, evidence });
  const report = formatDailyReport({ plan, roadmap, evidence, task, now });
  if (writeReport) fs.writeFileSync(path.join(root, 'PHASE2_DAILY_AGENT_REPORT.md'), report);
  return { plan, roadmap, evidence, task, report };
}

function selectDailyTask({ plan = {}, roadmap = {}, evidence = {} } = {}) {
  const killerFeature = plan.activeKillerFeature || roadmap.activeKillerFeature || null;
  if (!killerFeature) {
    if (evidence.hasFailingProductLab) {
      return dailyTask({
        classification: 'BUG_REPAIR',
        title: 'Repair Product Lab evidence reliability',
        reason: 'Screenshot evidence is required before Explain can be judged, and Product Lab reliability is currently weak.',
        allowedMutation: 'Only Product Lab, tests, workflow, or WhatsApp evidence-routing files.',
        founderDecisionNeeded: 'Choose the killer feature before feature implementation starts.'
      });
    }
    if (evidence.hasModifiedRuntimeFiles) {
      return dailyTask({
        classification: 'FOUNDATION_REVIEW',
        title: 'Review uncommitted runtime changes and validate foundation safety',
        reason: 'Protected keyboard files changed locally; daily work must not bury unverified foundation risk.',
        allowedMutation: 'Tests or reports only unless the runtime change has evidence and validation.',
        founderDecisionNeeded: 'Confirm whether the local runtime changes are intended.'
      });
    }
    return dailyTask({
      classification: 'PHASE2_READINESS',
      title: 'Strengthen Explain readiness without inventing the killer feature',
      reason: 'The killer feature is not locked, so agents should not create a 90-day feature roadmap yet.',
      allowedMutation: 'Bug fixes, tests, validation scripts, Product Lab reliability, and routing clarity.',
      founderDecisionNeeded: 'Define the killer feature or approve Explain as the locked 90-day wedge.'
    });
  }

  return dailyTask({
    classification: 'KILLER_FEATURE_EXECUTION',
    title: `Advance ${killerFeature} by one small verified step`,
    reason: 'The killer feature is locked, so daily work can become implementation-focused.',
    allowedMutation: 'One bounded change with tests, no protected hot-path mutation without evidence.',
    founderDecisionNeeded: 'Approve any protected runtime or privacy-sensitive change.'
  });
}

function collectDailyEvidence(root = ROOT) {
  const status = git(root, ['status', '--short']);
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  const hotPathPattern = /KeyboardService\.kt|SwipeGestureTracker\.kt|SwipeWordResolver\.kt|BasicPredictor\.kt/;
  const productLabFiles = listFiles(path.join(root, 'ai-cto', 'product-lab')).map((file) => relative(root, file));
  return {
    changedFiles,
    hasModifiedRuntimeFiles: changedFiles.some((file) => hotPathPattern.test(file)),
    hasFailingProductLab: fileContains(root, 'PHASE2_DAILY_AGENT_REPORT.md', 'Product Lab screenshot was rejected') ||
      changedFiles.some((file) => /product-lab|screenshot|workflow/i.test(file)),
    productLabFileCount: productLabFiles.length,
    roadmapLockPresent: fs.existsSync(path.join(root, 'ai-cto', 'roadmap-lock.json')),
    planPresent: fs.existsSync(path.join(root, 'ai-cto', 'phase2-daily-agent-plan.json'))
  };
}

function formatDailyReport({ plan, roadmap, evidence, task, now }) {
  return [
    '# PHASE2_DAILY_AGENT_REPORT',
    '',
    `Generated: ${now.toISOString()}`,
    '',
    '## Mission',
    `- ${plan.mission || 'Protect Phase 1 while preparing Phase 2.'}`,
    `- Current phase: ${roadmap.currentPhase || 'unknown'}`,
    `- Killer feature locked: ${plan.activeKillerFeature ? 'YES' : 'NO'}`,
    '',
    '## Today\'s Assigned Task',
    `- Classification: ${task.classification}`,
    `- Title: ${task.title}`,
    `- Reason: ${task.reason}`,
    `- Allowed mutation: ${task.allowedMutation}`,
    '',
    '## What Agents May Do Today',
    '- Inspect the whole repository.',
    '- Fix verified bugs.',
    '- Add or repair tests.',
    '- Improve Product Lab, WhatsApp routing, reports, and validation.',
    '- Commit only bounded changes with validation.',
    '',
    '## What Agents Must Not Do Today',
    '- Invent the killer feature.',
    '- Rewrite protected keyboard hot paths without evidence.',
    '- Add autonomous sending, hidden screenshot retention, or cloud dependence.',
    '- Treat reports as product progress unless they expose a decision or risk.',
    '',
    '## Evidence Snapshot',
    `- Changed files currently visible: ${evidence.changedFiles.length}`,
    `- Runtime hot-path changes visible: ${evidence.hasModifiedRuntimeFiles ? 'YES' : 'NO'}`,
    `- Product Lab files visible: ${evidence.productLabFileCount}`,
    '',
    '## Required End Of Day Proof',
    '- Files changed, if any.',
    '- Tests run.',
    '- Bugs fixed or reason mutation was unsafe.',
    '- Remaining blocker.',
    '- Founder decision needed.',
    '',
    '## Founder Decision Needed',
    `- ${task.founderDecisionNeeded}`,
    ''
  ].join('\n');
}

function dailyTask(values) {
  return values;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function fileContains(root, relativePath, needle) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8').includes(needle);
  } catch {
    return false;
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    return '';
  }
}

function relative(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

if (require.main === module) {
  const result = runPhase2DailyAgent({ writeReport: !process.argv.includes('--dry-run') });
  process.stdout.write(result.report);
}

module.exports = {
  collectDailyEvidence,
  formatDailyReport,
  runPhase2DailyAgent,
  selectDailyTask
};
