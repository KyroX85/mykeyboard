const fs = require('fs');
const path = require('path');

const CLASSIFICATIONS = Object.freeze([
  'CANONICAL',
  'SHADOW',
  'ORPHAN',
  'LEGACY',
  'DANGEROUS',
  'RUNTIME_CRITICAL',
  'FOUNDER_DNA',
  'SAFE_TO_ARCHIVE',
  'SAFE_TO_REMOVE',
  'UNVERIFIED'
]);

const DEFAULT_DONOR_ROOT = 'C:\\Users\\ADMIN\\ai-cto';

const SKIP_DIRS = new Set([
  '.git',
  '.gradle',
  '.idea',
  '.kotlin',
  'build',
  'node_modules'
]);

function exists(target) {
  try {
    return fs.existsSync(target);
  } catch (_) {
    return false;
  }
}

function safeRead(target) {
  try {
    return fs.readFileSync(target, 'utf8');
  } catch (_) {
    return '';
  }
}

function safeJson(target) {
  try {
    return JSON.parse(safeRead(target));
  } catch (_) {
    return null;
  }
}

function walkFiles(root, options = {}) {
  const maxFiles = options.maxFiles || 5000;
  const files = [];

  function walk(current) {
    if (files.length >= maxFiles || !exists(current)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else {
        files.push(full);
      }
    }
  }

  walk(root);
  return files;
}

function normalizePath(target) {
  return target.replace(/\\/g, '/');
}

function relativeOrAbsolute(root, target) {
  if (!target) return '';
  const rel = path.relative(root, target);
  return rel && !rel.startsWith('..') ? normalizePath(rel) : normalizePath(target);
}

function resolveRoots(options = {}) {
  const productRoot = options.productRoot || path.resolve(__dirname, '..');
  const canonicalCtoRoot = options.canonicalCtoRoot || path.join(productRoot, 'ai-cto');
  const donorRoot = options.donorRoot || process.env.ARITENIS_DONOR_CTO || DEFAULT_DONOR_ROOT;

  return {
    productRoot,
    canonicalCtoRoot,
    donorRoot,
    appRoot: path.join(productRoot, 'app'),
    workflowsRoot: path.join(productRoot, '.github', 'workflows')
  };
}

function readNpmExecutionPaths(roots) {
  const pkg = safeJson(path.join(roots.productRoot, 'package.json')) || {};
  const scripts = pkg.scripts || {};
  return Object.entries(scripts)
    .filter(([, command]) => /ai-cto|gradle|adb|node/.test(command))
    .map(([name, command]) => ({
      name,
      command,
      classification: command.includes('ai-cto/') ? 'RUNTIME_CRITICAL' : 'UNVERIFIED'
    }));
}

function readWorkflowExecutionPaths(roots) {
  if (!exists(roots.workflowsRoot)) return [];
  return fs.readdirSync(roots.workflowsRoot)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => {
      const file = path.join(roots.workflowsRoot, name);
      const content = safeRead(file);
      const runs = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('run:') || line.includes('node ai-cto') || line.includes('upload-artifact'));
      return {
        file: normalizePath(path.relative(roots.productRoot, file)),
        runs,
        classification: runs.some((line) => line.includes('ai-cto')) ? 'RUNTIME_CRITICAL' : 'UNVERIFIED'
      };
    });
}

function traceImports(root) {
  return walkFiles(root, { maxFiles: 2500 })
    .filter((file) => /\.(js|mjs|cjs|kt|kts|yml|yaml|json)$/.test(file))
    .map((file) => {
      const content = safeRead(file);
      const dependencies = [];
      const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const match of requireMatches) dependencies.push(match[1]);
      const importMatches = content.matchAll(/from ['"]([^'"]+)['"]/g);
      for (const match of importMatches) dependencies.push(match[1]);
      const commandRefs = content.matchAll(/\bai-cto\/[A-Za-z0-9_./-]+/g);
      for (const match of commandRefs) dependencies.push(match[0]);

      return {
        file: normalizePath(path.relative(root, file)),
        dependencies: [...new Set(dependencies)].sort()
      };
    })
    .filter((entry) => entry.dependencies.length > 0);
}

function compareDuplicateBasenames(roots) {
  const donorFiles = walkFiles(roots.donorRoot, { maxFiles: 2500 });
  const canonicalFiles = walkFiles(roots.canonicalCtoRoot, { maxFiles: 2500 });
  const donorByName = new Map();
  const canonicalByName = new Map();

  for (const file of donorFiles) {
    const name = path.basename(file);
    if (!donorByName.has(name)) donorByName.set(name, []);
    donorByName.get(name).push(file);
  }
  for (const file of canonicalFiles) {
    const name = path.basename(file);
    if (!canonicalByName.has(name)) canonicalByName.set(name, []);
    canonicalByName.get(name).push(file);
  }

  const duplicateNames = [...donorByName.keys()]
    .filter((name) => canonicalByName.has(name))
    .sort()
    .map((name) => ({
      name,
      donor: donorByName.get(name).map((file) => relativeOrAbsolute(roots.donorRoot, file)),
      canonical: canonicalByName.get(name).map((file) => relativeOrAbsolute(roots.canonicalCtoRoot, file)),
      classification: classifyDuplicateName(name)
    }));

  return duplicateNames;
}

function classifyDuplicateName(name) {
  if (/governance|brain|watcher|whatsapp|execution|state|memory/i.test(name)) return 'DANGEROUS';
  if (/report|md$/i.test(name)) return 'LEGACY';
  if (/test/i.test(name)) return 'UNVERIFIED';
  return 'SHADOW';
}

function mapOwnership(roots) {
  return [
    {
      system: 'Android product runtime',
      path: relativeOrAbsolute(roots.productRoot, roots.appRoot),
      currentAuthority: 'MyKeyboard/app',
      intendedAuthority: 'MyKeyboard/app',
      classification: 'RUNTIME_CRITICAL'
    },
    {
      system: 'Canonical execution CTO',
      path: relativeOrAbsolute(roots.productRoot, roots.canonicalCtoRoot),
      currentAuthority: 'GitHub/npm/WhatsApp/Product Lab activation',
      intendedAuthority: 'Canonical execution nervous system',
      classification: 'CANONICAL'
    },
    {
      system: 'Founder DNA donor CTO',
      path: roots.donorRoot,
      currentAuthority: 'Local standalone intelligence donor',
      intendedAuthority: 'Preserved donor, not direct execution root',
      classification: 'FOUNDER_DNA'
    },
    {
      system: 'GitHub workflows',
      path: relativeOrAbsolute(roots.productRoot, roots.workflowsRoot),
      currentAuthority: 'Workflow execution',
      intendedAuthority: 'Runtime activation map only during phase consolidation',
      classification: 'RUNTIME_CRITICAL'
    }
  ];
}

function discoverFounderDna(roots) {
  const candidates = walkFiles(roots.donorRoot, { maxFiles: 2500 })
    .filter((file) => /\.(js|md|json)$/.test(file))
    .map((file) => {
      const rel = relativeOrAbsolute(roots.donorRoot, file);
      const content = safeRead(file);
      let score = 0;
      if (/governance|preservation|autonomy|trust|founder|retention|product|privacy|nervous|canonical/i.test(rel)) score += 2;
      if (/trust >|retention|preservation|REAL_AUTONOMY|canonical|governance|founder/i.test(content)) score += 2;
      if (/report|memory|dataset|governance|intelligence/i.test(rel)) score += 1;
      return { file: rel, score, classification: score >= 3 ? 'FOUNDER_DNA' : 'UNVERIFIED' };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));

  return candidates.slice(0, 80);
}

function classifyArchiveCandidates(duplicates) {
  return duplicates
    .filter((entry) => entry.classification === 'LEGACY' || entry.classification === 'SHADOW')
    .map((entry) => ({
      name: entry.name,
      classification: entry.classification === 'LEGACY' ? 'SAFE_TO_ARCHIVE' : 'UNVERIFIED',
      reason: entry.classification === 'LEGACY'
        ? 'Report or markdown duplicate can usually be archived after canonical report source is chosen.'
        : 'Code duplicate requires import tracing before archive decision.'
    }));
}

function buildSafeTransplantOrder() {
  return [
    'Freeze movement: no folder moves, no root renames, no package.json path changes.',
    'Register MyKeyboard/ai-cto as canonical execution nervous system for this phase.',
    'Register C:\\Users\\ADMIN\\ai-cto as founder DNA donor and read-only intelligence source.',
    'Trace npm scripts, GitHub workflows, WhatsApp launch paths, Product Lab paths, and imports.',
    'Classify duplicate files by risk: governance/execution/memory first, reports last.',
    'Transplant only ideas and policy semantics into canonical modules after tests exist.',
    'Add adapter or report-only modules before replacing active execution logic.',
    'Verify WhatsApp, Product Lab, privacy boundary, and governance tests after each transplant.',
    'Archive stale donor/report artifacts only after founder approval.',
    'Declare one governance, memory, dataset, and execution authority only after runtime validation.'
  ];
}

function buildTransplantationPlan(options = {}) {
  const roots = resolveRoots(options);
  const npmExecution = readNpmExecutionPaths(roots);
  const workflowExecution = readWorkflowExecutionPaths(roots);
  const canonicalImports = traceImports(roots.canonicalCtoRoot);
  const workflowImports = exists(roots.workflowsRoot) ? traceImports(roots.workflowsRoot) : [];
  const duplicates = compareDuplicateBasenames(roots);
  const founderDna = discoverFounderDna(roots);

  return {
    generatedAt: new Date().toISOString(),
    classifications: CLASSIFICATIONS,
    roots,
    authorities: mapOwnership(roots),
    runtimeActivation: {
      npmExecution,
      workflowExecution,
      whatsapp: npmExecution.filter((entry) => /whatsapp/i.test(entry.name + entry.command)),
      productLab: npmExecution.filter((entry) => /product-lab|ux-lab|screenshot|emulator/i.test(entry.name + entry.command))
    },
    importDependencies: {
      canonical: canonicalImports.slice(0, 200),
      workflows: workflowImports.slice(0, 50)
    },
    duplicates,
    founderDna,
    archiveCandidates: classifyArchiveCandidates(duplicates),
    risks: [
      'Split-brain governance if donor governance executes beside canonical governance.',
      'Memory drift if .brain_state.json or product-operational-memory.json remains authoritative in two roots.',
      'Workflow breakage if package.json or .github paths are rewritten too early.',
      'Founder DNA loss if donor files are overwritten by shorter active modules.',
      'Runtime instability if Android hot-path files are touched during consolidation.'
    ],
    untouchableSystems: [
      'app/src/main/java/com/example/mykeyboard/KeyboardService.kt',
      'app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt',
      'app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt',
      'app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt',
      'package.json execution paths',
      '.github/workflows execution paths',
      'ai-cto/whatsapp-server.js launch behavior',
      'ai-cto/product-lab scheduled validation behavior'
    ],
    safeTransplantOrder: buildSafeTransplantOrder(),
    migrationConfidence: {
      level: 'MEDIUM',
      reason: 'Activation paths are visible, but import-level semantic equivalence between donor and canonical systems is not verified yet.'
    }
  };
}

function summarizePlan(plan) {
  return {
    currentAuthority: 'MyKeyboard/ai-cto is runtime-executed by npm scripts and GitHub workflows.',
    intendedAuthority: 'MyKeyboard/ai-cto remains canonical execution nervous system; C:\\Users\\ADMIN\\ai-cto becomes read-only founder DNA donor.',
    duplicateCount: plan.duplicates.length,
    founderDnaCount: plan.founderDna.length,
    npmExecutionCount: plan.runtimeActivation.npmExecution.length,
    workflowCount: plan.runtimeActivation.workflowExecution.length,
    migrationConfidence: plan.migrationConfidence
  };
}

function renderReport(title, plan, focus = {}) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push('## CURRENT AUTHORITY');
  lines.push('- `MyKeyboard/ai-cto` is the current runtime-executed CTO because npm scripts and GitHub workflows call `ai-cto/...` from the product repo.');
  lines.push('- `C:\\Users\\ADMIN\\ai-cto` is the founder DNA donor and local standalone CTO source.');
  lines.push('');
  lines.push('## INTENDED AUTHORITY');
  lines.push('- Canonical execution nervous system: `MyKeyboard/ai-cto`.');
  lines.push('- Intelligence donor: `C:\\Users\\ADMIN\\ai-cto`.');
  lines.push('- Android runtime authority: `MyKeyboard/app`.');
  lines.push('');
  lines.push('## RUNTIME ACTIVATION');
  lines.push(`- npm activation paths discovered: ${plan.runtimeActivation.npmExecution.length}.`);
  lines.push(`- GitHub workflow files discovered: ${plan.runtimeActivation.workflowExecution.length}.`);
  lines.push(`- WhatsApp activation paths discovered: ${plan.runtimeActivation.whatsapp.length}.`);
  lines.push(`- Product Lab activation paths discovered: ${plan.runtimeActivation.productLab.length}.`);
  lines.push('');
  lines.push('## IMPORT DEPENDENCIES');
  lines.push(`- Canonical import-bearing files sampled: ${plan.importDependencies.canonical.length}.`);
  lines.push(`- Workflow command/reference files sampled: ${plan.importDependencies.workflows.length}.`);
  lines.push('- Import rewrites are not approved in this phase.');
  lines.push('');
  lines.push('## DUPLICATE RISKS');
  for (const item of plan.duplicates.slice(0, focus.duplicateLimit || 12)) {
    lines.push(`- ${item.classification}: ${item.name}`);
  }
  lines.push('');
  lines.push('## SPLIT-BRAIN RISKS');
  for (const risk of plan.risks) lines.push(`- ${risk}`);
  lines.push('');
  lines.push('## SAFE TRANSPLANT ORDER');
  for (const step of plan.safeTransplantOrder) lines.push(`- ${step}`);
  lines.push('');
  lines.push('## UNTOUCHABLE SYSTEMS');
  for (const item of plan.untouchableSystems) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## FOUNDER DNA SYSTEMS');
  for (const item of plan.founderDna.slice(0, focus.founderDnaLimit || 12)) {
    lines.push(`- ${item.classification}: ${item.file}`);
  }
  lines.push('');
  lines.push('## ARCHIVE CANDIDATES');
  for (const item of plan.archiveCandidates.slice(0, focus.archiveLimit || 10)) {
    lines.push(`- ${item.classification}: ${item.name} - ${item.reason}`);
  }
  lines.push('');
  lines.push('## MIGRATION CONFIDENCE');
  lines.push(`- ${plan.migrationConfidence.level}: ${plan.migrationConfidence.reason}`);
  lines.push('');
  lines.push('## WHAT REMAINS UNCHANGED');
  lines.push('- No folders moved.');
  lines.push('- No imports rewritten.');
  lines.push('- No package scripts changed.');
  lines.push('- No GitHub workflows changed.');
  lines.push('- No Android runtime files changed.');
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  CLASSIFICATIONS,
  buildTransplantationPlan,
  compareDuplicateBasenames,
  discoverFounderDna,
  exists,
  mapOwnership,
  readNpmExecutionPaths,
  readWorkflowExecutionPaths,
  renderReport,
  resolveRoots,
  summarizePlan,
  traceImports
};
