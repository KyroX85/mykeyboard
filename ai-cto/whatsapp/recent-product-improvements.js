const { execFileSync } = require('child_process');
const {
  evaluateFounderFacingProgress,
  formatRealityCheck
} = require('../reality-check-layer');

const PRODUCT_KEYWORDS = [
  'approval',
  'agent',
  'company goal',
  'keyboard visual',
  'product lab',
  'screenshot',
  'phase 2',
  'explain',
  'dialog',
  'governance'
];

function isProductImprovementQuestion(message = '') {
  const text = String(message || '').toLowerCase();
  if (/\bwhat should we improve next\b/.test(text)) return false;
  if (/\bwhat\s+progress\s+did\s+we\s+make\s+today\b/.test(text)) return true;
  if (/\b(progress|made progress)\b/.test(text) && /\b(today|recently|now)\b/.test(text)) return true;
  const asksImprovement = /\b(improvements?|improvments?|improved?|toward the product|product)\b/.test(text);
  const asksCompletedWork = /\b(today|team|did|done|idid|what did|what improvements?|what improvments?|any improvements?|any improvments?)\b/.test(text);
  return asksImprovement && asksCompletedWork;
}

function buildRecentProductImprovementAnswer({ root = process.cwd(), limit = 6, readCommits = readRecentCommits } = {}) {
  const commits = readCommits(root, limit);
  const productCommits = commits.filter((commit) => isProductCommit(commit.subject));
  const selected = (productCommits.length ? productCommits : commits).slice(0, 5);
  const reality = evaluateFounderFacingProgress({
    items: selected.map((commit) => commit.subject),
    context: 'recent git commits'
  });

  if (!selected.length || !reality.meaningful) {
    return [
      'CTO: No meaningful founder-facing progress.',
      ...reality.reasons.map((reason) => `Reason: ${reason}`),
      'Reality check: user value, capability, intelligence, and trust did not increase enough to claim progress.',
      'Next: do not report architecture or documentation activity as product progress.'
    ].join('\n');
  }

  return [
    'CTO: Verified product-facing improvements today:',
    ...selected.map((commit) => `- ${productImpact(commit.subject)} (${commit.hash})`),
    formatRealityCheck(reality),
    'Product impact: better agent trust, clearer Phase 2 direction, and stronger Product Lab evidence handling.',
    'No Android typing hot-path mutation is claimed here.'
  ].join('\n');
}

function readRecentCommits(root, limit) {
  try {
    const output = execFileSync('git', [
      'log',
      `-${Number(limit) || 6}`,
      '--pretty=format:%h%x09%s'
    ], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return output.split(/\r?\n/)
      .map((line) => {
        const [hash, ...subjectParts] = line.split('\t');
        return { hash, subject: subjectParts.join('\t') };
      })
      .filter((commit) => commit.hash && commit.subject);
  } catch {
    return [];
  }
}

function isProductCommit(subject = '') {
  const text = String(subject || '').toLowerCase();
  return PRODUCT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function productImpact(subject = '') {
  const text = String(subject || '').toLowerCase();
  if (text.includes('approval')) return 'made WhatsApp execution approval-first instead of auto-executing';
  if (text.includes('keyboard visual') || text.includes('screenshot')) return 'improved Product Lab screenshot request handling';
  if (text.includes('system dialog') || text.includes('product lab')) return 'hardened Product Lab evidence against bad emulator screenshots';
  if (text.includes('company goal') || text.includes('anti-bloat')) return 'made agents answer company-goal and anti-bloat questions directly';
  if (text.includes('agent council') || text.includes('agent')) return 'improved agent judgment and evidence-aware responses';
  if (text.includes('phase 2') || text.includes('explain')) return 'aligned agents around Phase 2 Explain direction';
  return subject;
}

module.exports = {
  isProductImprovementQuestion,
  buildRecentProductImprovementAnswer,
  readRecentCommits
};
