const fs = require('fs');
const path = require('path');

function compareKeyboardTargets({
  candidate,
  baseline,
  minThumbTargetPx = 44
} = {}) {
  const candidateKeys = keysById(candidate && candidate.keys);
  const baselineKeys = keysById(baseline && baseline.keys);
  const findings = [];

  for (const [keyId, key] of candidateKeys.entries()) {
    const reference = baselineKeys.get(keyId);
    const targetWidth = Number(key.width || 0);
    const targetHeight = Number(key.height || 0);
    const referenceWidth = Number(reference && reference.width || minThumbTargetPx);
    const referenceHeight = Number(reference && reference.height || minThumbTargetPx);
    const belowMinimum = targetWidth < minThumbTargetPx || targetHeight < minThumbTargetPx;

    if (!belowMinimum) continue;
    findings.push({
      keyId,
      type: 'thumb-target',
      severity: belowMinimum ? 'HIGH' : 'MEDIUM',
      candidate: {
        width: targetWidth,
        height: targetHeight
      },
      baseline: {
        width: referenceWidth,
        height: referenceHeight
      },
      message: `${keyId} thumb target is ${targetWidth}x${targetHeight}px versus ${referenceWidth}x${referenceHeight}px baseline.`
    });
  }

  return {
    status: findings.length ? 'ATTENTION_NEEDED' : 'NO_TARGET_GAP_DETECTED',
    candidateName: (candidate && candidate.name) || 'Aritenis',
    baselineName: (baseline && baseline.name) || 'Mature keyboard baseline',
    candidateScreenshot: candidate && candidate.screenshot || null,
    baselineScreenshot: baseline && baseline.screenshot || null,
    minThumbTargetPx,
    findings,
    summary: findings.length
      ? `${findings.length} thumb-target issue(s) found against the mature keyboard baseline.`
      : 'No thumb-target issue found against the mature keyboard baseline.'
  };
}

function formatUxComparisonReport(comparison) {
  const findings = Array.isArray(comparison.findings) ? comparison.findings : [];
  return [
    '# UX_COMPARISON_REPORT',
    '',
    '## WHAT WAS COMPARED',
    `- Candidate: ${comparison.candidateName}`,
    `- Baseline: ${comparison.baselineName}`,
    `- Minimum thumb target: ${comparison.minThumbTargetPx}px`,
    '',
    '## FINDINGS',
    findings.length
      ? findings.map((finding) => `- ${finding.severity}: ${finding.message}`).join('\n')
      : '- No measurable thumb-target gap detected.',
    '',
    '## FEEL IMPACT',
    '- Smaller targets can make typing feel less calm because edge keys require more precision.',
    '',
    '## RHYTHM IMPACT',
    '- Thumb-target misses can create backspaces and hesitation during fast typing.',
    '',
    '## CONFIDENCE IMPACT',
    '- Repeated small misses can reduce confidence even when the keyboard technically works.',
    '',
    '## TRUST IMPACT',
    '- Trust risk rises when mature-keyboard targets feel easier to hit than Aritenis targets.',
    '',
    '## REGRESSION RISK',
    '- Low for analysis only. Any layout patch must remain approval-gated.',
    '',
    '## WHAT COULD BECOME ANNOYING LONG-TERM',
    '- Keys that are just slightly too small may create silent fatigue over months.',
    '',
    '## APPROVAL REQUIRED BEFORE PATCH',
    '- No runtime mutation should happen from this report alone.',
    ''
  ].join('\n');
}

function generateComparisonSvg({
  comparison,
  outputFile
} = {}) {
  if (!outputFile) throw new Error('outputFile is required');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const findings = Array.isArray(comparison.findings) ? comparison.findings : [];
  const findingLines = findings.length
    ? findings.map((finding, index) => svgText(40, 170 + index * 28, `${finding.keyId}: ${finding.message}`)).join('\n')
    : svgText(40, 170, 'No thumb target issue found.');

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520">',
    '<rect width="1200" height="520" fill="#f7f7f4"/>',
    '<rect x="32" y="48" width="520" height="96" fill="#ffffff" stroke="#333333"/>',
    '<rect x="648" y="48" width="520" height="96" fill="#ffffff" stroke="#333333"/>',
    svgText(52, 104, comparison.candidateName || 'Aritenis', 32),
    svgText(668, 104, comparison.baselineName || 'Mature baseline', 32),
    '<line x1="600" y1="32" x2="600" y2="488" stroke="#999999" stroke-dasharray="8 8"/>',
    '<rect x="32" y="152" width="1136" height="300" fill="#ffffff" stroke="#bbbbbb"/>',
    svgText(40, 190, 'Annotated thumb target comparison', 24),
    findingLines,
    svgText(40, 468, 'Approval gated: analysis only. No keyboard runtime patch from this artifact.', 20),
    '</svg>'
  ].join('\n');
  fs.writeFileSync(outputFile, svg);
  return outputFile;
}

function keysById(keys) {
  const output = new Map();
  for (const key of Array.isArray(keys) ? keys : []) {
    if (!key || !key.id) continue;
    output.set(String(key.id), key);
  }
  return output;
}

function svgText(x, y, value, size = 18) {
  return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="#202020">${escapeXml(value)}</text>`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  compareKeyboardTargets,
  formatUxComparisonReport,
  generateComparisonSvg
};
