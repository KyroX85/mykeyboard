const assert = require('assert');
const { buildNvidiaCouncil, formatNvidiaCouncil } = require('../orchestration/nvidia-council-engine');
const { routeControlPlaneCommandWithModels } = require('../orchestration/agent-control-plane');
const { routeMessageWithAi } = require('../whatsapp/command-router');

function fakeClient() {
  const calls = [];
  return {
    calls,
    available: (kind) => ['llama', 'deepseek', 'qwenCoder'].includes(kind),
    chat: async (kind, messages) => {
      calls.push({ kind, messages });
      const content = kind === 'deepseek'
        ? 'Position: REVIEW\nEvidence: implementation likely touches Product Lab only.\nRisk: low if no keyboard runtime files change.\nRecommendation: prepare bounded patch after approval.'
        : kind === 'qwenCoder'
          ? 'Position: CAUTION\nEvidence: screenshot evidence can be misleading.\nRisk: privacy and false-evidence risk if screenshots persist forever.\nRecommendation: require explicit trigger and temporary context.'
          : 'Position: SUPPORT\nEvidence: aligns with Explain wedge.\nRisk: medium until Product Lab evidence is clean.\nRecommendation: design first, no execution.';
      return { ok: true, model: `${kind}-model`, content, usage: { total_tokens: 12 } };
    }
  };
}

(async () => {
  const client = fakeClient();
  const council = await buildNvidiaCouncil({
    proposal: 'explain this screenshot before I reply',
    client
  });
  assert.strictEqual(council.mode, 'NVIDIA_MODEL_COUNCIL');
  assert(client.calls.length >= 6);
  assert(council.summary.consensus.includes('Model council'));
  assert(council.summary.dissent.includes('Risk') || council.summary.dissent.includes('privacy'));
  assert(council.summary.approvalNeeded.includes('implementation') || council.summary.approvalNeeded.includes('Founder approval'));
  const formatted = formatNvidiaCouncil(council);
  assert(formatted.includes('model council reviewed this'));
  assert(formatted.includes('Model council:'));
  assert(formatted.includes('No execution started'));

  const routed = await routeControlPlaneCommandWithModels('nvidia council: explain this screenshot before I reply', {
    nvidiaClient: fakeClient()
  });
  assert.strictEqual(routed.command, 'nvidia_agent_council');
  assert(routed.response.includes('model council reviewed this'));

  const whatsapp = await routeMessageWithAi('nvidia council: explain this screenshot before I reply', {}, {}, {
    nvidiaClient: fakeClient()
  });
  assert.strictEqual(whatsapp.command, 'nvidia_agent_council');
  assert.strictEqual(whatsapp.usedAi, true);
  assert(!whatsapp.response.includes('Starting execution'));

  const fallbackClient = { available: () => false };
  const fallback = await buildNvidiaCouncil({
    proposal: 'explain this screenshot before I reply',
    client: fallbackClient
  });
  assert.strictEqual(fallback.mode, 'DETERMINISTIC_COUNCIL_FALLBACK');
  assert(fallback.summary.fallbackReason.includes('not enough NVIDIA'));

  console.log('NVIDIA council engine checks passed');
})();
