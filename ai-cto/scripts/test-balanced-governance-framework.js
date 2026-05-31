const assert = require('assert');
const {
  DECISION_AUTHORITY,
  decideGovernanceAuthority,
  formatGovernanceFramework
} = require('../balanced-governance-framework');
const { shouldBlockDirectProductExecution } = require('../product-governance');

function run() {
  const framework = formatGovernanceFramework();
  assert(framework.includes('Minimum Governance Required for Safe Execution'));
  assert(framework.includes('Hard Safety Rules'));
  assert(framework.includes('Soft Preferences'));

  const nonMutating = decideGovernanceAuthority({
    action: 'product_lab',
    task: 'capture screenshot and generate report'
  });
  assert.strictEqual(nonMutating.level, DECISION_AUTHORITY.FULLY_AUTONOMOUS);
  assert.strictEqual(nonMutating.requiresConfirmation, false);

  const safeDocs = decideGovernanceAuthority({
    action: 'file_modify',
    task: 'documentation cleanup for briefing report',
    files: ['ai-cto/SYSTEM_BRIEFING.md'],
    riskLevel: 'LOW',
    diff: { existingFilesChanged: 1, existingLinesChanged: 12 }
  });
  assert.strictEqual(safeDocs.level, DECISION_AUTHORITY.EXECUTE_WITH_CONSTRAINTS);
  assert.strictEqual(safeDocs.requiresConfirmation, false);

  const hardBlock = decideGovernanceAuthority({
    action: 'file_modify',
    task: 'change database token and privacy export behavior',
    files: ['app/google-services.json'],
    riskLevel: 'HIGH'
  });
  assert.strictEqual(hardBlock.level, DECISION_AUTHORITY.BLOCK);
  assert.strictEqual(hardBlock.allowed, false);

  const protectedWeakEvidence = shouldBlockDirectProductExecution({
    files: ['app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt'],
    task: 'tune prediction behavior',
    action: 'file_modify'
  });
  assert.strictEqual(protectedWeakEvidence.blocked, true);
  assert.strictEqual(protectedWeakEvidence.decisionLevel, DECISION_AUTHORITY.ASK_CONFIRMATION);

  const protectedStrongEvidence = shouldBlockDirectProductExecution({
    files: ['app/src/main/java/com/example/mykeyboard/KeyboardSizingProfile.kt'],
    task: 'tiny adaptive sizing adjustment from screenshot evidence',
    action: 'file_modify',
    evidence: { screenshotEvidence: true },
    validation: { testsPassed: true },
    diff: { existingFilesChanged: 1, existingLinesChanged: 8 }
  });
  assert.strictEqual(protectedStrongEvidence.blocked, false);
  assert.strictEqual(protectedStrongEvidence.decisionLevel, DECISION_AUTHORITY.EXECUTE_WITH_CONSTRAINTS);

  const mediumNonProtected = shouldBlockDirectProductExecution({
    files: ['ai-cto/whatsapp/lightweight-conversation-engine.js'],
    task: 'bounded routing fix with tests',
    changes: ['one function guard'],
    action: 'file_modify',
    diff: { existingFilesChanged: 1, existingLinesChanged: 20 }
  });
  assert.strictEqual(mediumNonProtected.blocked, false);
  assert(mediumNonProtected.authority.constraints.includes('validation required'));

  const preservation = decideGovernanceAuthority({
    action: 'file_write',
    task: 'write file during preservation',
    governanceMode: 'PRESERVATION_ONLY',
    files: ['ai-cto/test.txt']
  });
  assert.strictEqual(preservation.level, DECISION_AUTHORITY.BLOCK);

  console.log('test-balanced-governance-framework: PASS');
}

run();
