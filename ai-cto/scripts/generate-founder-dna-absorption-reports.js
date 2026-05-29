const fs = require('fs');
const path = require('path');
const { getFounderDnaCore } = require('../founder-dna-core');
const { verifyFounderDnaAbsorption } = require('../founder-dna-absorption-engine');
const { buildOperationalIdentity } = require('../operational-identity-engine');

const ROOT = path.resolve(__dirname, '..', '..');
const core = getFounderDnaCore();
const absorption = verifyFounderDnaAbsorption({ productRoot: ROOT });
const identity = buildOperationalIdentity();

function section(title, lines) {
  return [`## ${title}`, ...lines, ''].join('\n');
}

function bullets(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

const absorptionReport = [
  '# Founder DNA Absorption Report',
  '',
  section('SOURCE AUTHORITY', [`- ${core.donorAuthority}`]),
  section('TARGET AUTHORITY', [`- ${core.authority}`]),
  section('ABSORPTION DECISION', [
    `- ${absorption.decision}`,
    `- Mode: ${absorption.absorptionMode}`,
    `- Runtime impact: ${absorption.runtimeImpact}`,
    `- Memory impact: ${absorption.memoryImpact}`,
    `- Governance impact: ${absorption.governanceImpact}`,
    `- WhatsApp impact: ${absorption.whatsappImpact}`
  ]),
  section('ABSORBED DOCTRINE', [
    `- North star: ${core.productNorthStar}`,
    bullets(core.hierarchy),
    bullets(core.phaseOnePriorities),
    bullets(core.productTaste)
  ]),
  section('FORBIDDEN DRIFT', [bullets(core.forbiddenDrift)]),
  section('ROLLBACK STRATEGY', [`- ${absorption.rollbackStrategy}`]),
  section('ABSORPTION CONFIDENCE', [
    absorption.missing.length
      ? `- LOW: missing ${absorption.missing.join(', ')}`
      : '- HIGH for semantic absorption; runtime and persistence convergence remain separately gated.'
  ])
].join('\n');

const operationalReport = [
  '# Canonical Founder DNA Core Report',
  '',
  section('CURRENT AUTHORITY', ['- MyKeyboard/ai-cto is the execution authority.']),
  section('TARGET AUTHORITY', [`- ${identity.targetAuthority}`]),
  section('RUNTIME DEPENDENCIES', ['- package.json, workflows, WhatsApp paths, and Android runtime paths unchanged.']),
  section('ACTIVE IMPORT PATHS', [
    '- whatsapp/command-router.js consumes canonical-product-judgment-engine.js for product conversation.',
    '- product-lab/calm-dialogue-engine.js consumes canonical-product-judgment-engine.js for calm product discussion.',
    '- operational-identity-engine.js consumes founder-dna-core.js.'
  ]),
  section('EXECUTION ROOT IMPACT', ['- UNCHANGED']),
  section('WORKFLOW IMPACT', ['- UNCHANGED']),
  section('WHATSAPP IMPACT', ['- Founder-aligned product discussion now routes through canonical DNA. Explicit execution still goes through existing governance paths.']),
  section('MEMORY IMPACT', ['- No JSON memory store merged.']),
  section('DATASET IMPACT', ['- No dataset moved or rewritten.']),
  section('FOUNDER DNA VALUE', [
    `- ${identity.productNorthStar}`,
    bullets(identity.principles),
    bullets(identity.productTaste)
  ]),
  section('RETIREMENT SAFETY', ['- Donor root is not safe to retire yet; it remains rollback/reference DNA.']),
  section('ROLLBACK STRATEGY', ['- Remove the additive founder DNA core and consumers; no runtime path restoration required.']),
  section('CONVERGENCE CONFIDENCE', ['- HIGH for canonical doctrine absorption; MEDIUM for full operational convergence because persistence remains frozen.'])
].join('\n');

fs.writeFileSync(path.join(ROOT, 'FOUNDER_DNA_ABSORPTION_REPORT.md'), absorptionReport);
fs.writeFileSync(path.join(ROOT, 'CANONICAL_FOUNDER_DNA_CORE_REPORT.md'), operationalReport);

console.log('Generated founder DNA absorption reports');
