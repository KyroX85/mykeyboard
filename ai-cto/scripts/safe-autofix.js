const fs = require('fs');
const path = require('path');

const root = process.cwd();
const apply = process.argv.includes('--apply');
const summaryFile = path.join(root, 'ai-cto', 'autofix-summary.json');
const changes = [];

const ignoredSegments = new Set(['.git', '.gradle', '.idea', '.ai-pipeline', 'build', 'node_modules', 'gradle']);
const tempExtensions = new Set(['.tmp', '.bak', '.orig']);
const markdownNames = new Set(['README.md', 'NEXT.md', 'CONTRIBUTING.md']);

function partsOf(filePath) {
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean);
}

function isIgnored(filePath) {
  const relative = path.relative(root, filePath).replace(/\\/g, '/');
  if (relative.startsWith('app/src/main/java/') || relative.startsWith('app/src/main/kotlin/')) return true;
  return partsOf(relative).some(part => ignoredSegments.has(part));
}

function walk(dir, files = []) {
  if (isIgnored(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function record(action, file, detail) {
  changes.push({ action, file: path.relative(root, file).replace(/\\/g, '/'), detail });
}

function cleanupTempFile(file) {
  if (!tempExtensions.has(path.extname(file))) return;
  record('delete-temp-file', file, 'Stale temporary file cleanup.');
  if (apply) fs.unlinkSync(file);
}

function cleanupMarkdown(file) {
  if (!markdownNames.has(path.basename(file)) && !partsOf(file).includes('docs')) return;
  const original = fs.readFileSync(file, 'utf8');
  const cleaned = original
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n*$/g, '\n');
  if (cleaned === original) return;
  record('format-markdown', file, 'Trim trailing whitespace and normalize final newline.');
  if (apply) fs.writeFileSync(file, cleaned);
}

function normalizeXmlNewline(file) {
  if (path.extname(file) !== '.xml') return;
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (!relative.startsWith('app/src/main/res/')) return;
  const original = fs.readFileSync(file, 'utf8');
  if (original.endsWith('\n')) return;
  record('format-xml-newline', file, 'Normalize final newline only.');
  if (apply) fs.writeFileSync(file, `${original}\n`);
}

function main() {
  fs.mkdirSync(path.dirname(summaryFile), { recursive: true });
  for (const file of walk(root)) {
    if (isIgnored(file)) continue;
    cleanupTempFile(file);
    if (fs.existsSync(file)) cleanupMarkdown(file);
    if (fs.existsSync(file)) normalizeXmlNewline(file);
  }

  const summary = {
    version: '1.0',
    mode: apply ? 'apply' : 'check',
    generatedAt: new Date().toISOString(),
    allowedScopes: [
      'stale temporary file cleanup',
      'documentation whitespace cleanup',
      'resource XML final newline normalization'
    ],
    forbiddenScopes: [
      'predictor changes',
      'database changes',
      'networking changes',
      'privacy changes',
      'lifecycle rewrites',
      'gesture or swipe rewrites'
    ],
    changes
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`[cto-autofix] mode=${summary.mode}; changes=${changes.length}`);
}

main();
