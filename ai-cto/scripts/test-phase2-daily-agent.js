const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runPhase2DailyAgent,
  runPhase2DailyAgentWithCouncil,
  selectDailyTask
} = require('./phase2-daily-agent');

const waitingTask = selectDailyTask({
  plan: { activeKillerFeature: null },
  roadmap: { currentPhase: 'Phase 2 Preparation - Explain Wedge' },
  evidence: { hasFailingProductLab: false, hasModifiedRuntimeFiles: false }
});
assert.strictEqual(waitingTask.classification, 'PHASE2_READINESS');
assert(waitingTask.reason.includes('killer feature is not locked'));

const bugTask = selectDailyTask({
  plan: { activeKillerFeature: null },
  evidence: { hasFailingProductLab: true, hasModifiedRuntimeFiles: false }
});
assert.strictEqual(bugTask.classification, 'BUG_REPAIR');
assert(bugTask.allowedMutation.includes('Product Lab'));

const runtimeTask = selectDailyTask({
  plan: { activeKillerFeature: null },
  evidence: { hasFailingProductLab: false, hasModifiedRuntimeFiles: true }
});
assert.strictEqual(runtimeTask.classification, 'FOUNDATION_REVIEW');

const lockedTask = selectDailyTask({
  plan: { activeKillerFeature: 'Explain screenshot' },
  evidence: {}
});
assert.strictEqual(lockedTask.classification, 'KILLER_FEATURE_EXECUTION');

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-daily-agent-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'phase2-daily-agent-plan.json'), JSON.stringify({
      mission: 'Protect Phase 1 while preparing Phase 2.',
      activeKillerFeature: null
    }));
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'roadmap-lock.json'), JSON.stringify({
      currentPhase: 'Phase 2 Preparation - Explain Wedge'
    }));
    const result = runPhase2DailyAgent({
      root: tempRoot,
      now: new Date('2026-05-30T10:00:00.000Z')
    });
    assert.strictEqual(result.task.classification, 'PHASE2_READINESS');
    assert(fs.existsSync(path.join(tempRoot, 'PHASE2_DAILY_AGENT_REPORT.md')));
    assert(result.report.includes('What Agents May Do Today'));
    assert(result.report.includes('Founder Decision Needed'));
    assert(result.report.includes('Model Council'));
    assert(result.report.includes('not run in this mode'));
    assert(!result.report.includes('auto-send user content'));

    const councilResult = await runPhase2DailyAgentWithCouncil({
      root: tempRoot,
      now: new Date('2026-05-30T10:00:00.000Z'),
      nvidiaClient: fakeCouncilClient()
    });
    assert.strictEqual(councilResult.council.mode, 'NVIDIA_MODEL_COUNCIL');
    assert(councilResult.report.includes('Mode: NVIDIA_MODEL_COUNCIL'));
    assert(councilResult.report.includes('Consensus:'));
    assert(councilResult.report.includes('Approval needed:'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('Phase 2 daily agent checks passed');
})();

function fakeCouncilClient() {
  return {
    available: (kind) => ['llama', 'deepseek', 'qwenCoder'].includes(kind),
    chat: async (kind) => ({
      ok: true,
      model: `${kind}-model`,
      content: kind === 'deepseek'
        ? 'Position: REVIEW\nEvidence: daily mission is bounded.\nRisk: Product Lab only.\nRecommendation: proceed with report-only mission.'
        : 'Position: SUPPORT\nEvidence: aligns with Explain readiness.\nRisk: low because no execution starts.\nRecommendation: keep founder approval gate.'
    })
  };
}
