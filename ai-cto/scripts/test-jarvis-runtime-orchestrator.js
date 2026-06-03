const assert = require('assert');
const http = require('http');

const {
  runJarvisRuntime,
  normalizeJarvisInput,
  buildFinalDecision
} = require('../jarvis-runtime-orchestrator');
const { assertJarvisSpeechSafe } = require('../jarvis-speech-layer');

assert.deepStrictEqual(normalizeJarvisInput('Hey Jarvis, why am I building Jarvis?'), {
  received: 'Hey Jarvis, why am I building Jarvis?',
  wakeWordDetected: true,
  question: 'why am I building Jarvis?'
});

assert.strictEqual(buildFinalDecision({
  brain: { type: 'reflection' },
  council: { decision: 'REVIEW_BEFORE_EXECUTION' },
  councilSummary: { dissent: 'needs review' }
}).agentsMaySpeakDirectly, false);

(async () => {
  const runtime = await runJarvisRuntime({
    input: 'Hey Jarvis, why am I building Jarvis?',
    founderBrain: async ({ question }) => ({
      type: 'reflection',
      summary: 'You are building Jarvis to reduce the burden humans carry alone.',
      rawReasoning: `Question: ${question}`,
      voiceSummary: 'Jarvis reduces burden while preserving agency.',
      confidence: 0.84,
      route: { command: 'founder_mind_reconstruction' }
    }),
    agentCouncil: () => ({
      decision: 'REVIEW_BEFORE_EXECUTION',
      votes: [],
      roadmap: { classification: 'PHASE2' },
      safeNextStep: 'No execution.',
      evidence: { confidence: 'MEDIUM', missing: [] }
    })
  });

  assert.strictEqual(runtime.ok, true);
  assert.strictEqual(runtime.entryPoint, 'jarvis_runtime');
  assert.deepStrictEqual(runtime.flow, [
    'wake_word',
    'jarvis_runtime',
    'founder_brain',
    'agent_council',
    'final_decision',
    'execution_layer',
    'response'
  ]);
  assert.strictEqual(runtime.response, 'Jarvis reduces burden while preserving agency');
  assert.strictEqual(runtime.spokenResponse, runtime.voiceSummary);
  assert.strictEqual(runtime.finalDecision.agentsMaySpeakDirectly, false);
  assert.strictEqual(runtime.finalDecision.jarvisSpeaks, 'voiceSummary');
  assert.strictEqual(runtime.executionLayer.mode, 'NO_ACTION');
  assert(!/Founder Brain summary|Roadmap Agent|Product Judgment Agent/.test(runtime.response));

  const executionRuntime = await runJarvisRuntime({
    input: 'Jarvis execute this change',
    founderBrain: async () => ({
      type: 'execution',
      summary: 'Prepare an action.',
      rawReasoning: 'Execution request.',
      voiceSummary: 'I need approval before action.',
      confidence: 0.72,
      route: { command: 'vision_command_approval_required' }
    }),
    agentCouncil: () => ({
      decision: 'APPROVE_DESIGN_ONLY',
      votes: [],
      roadmap: { classification: 'EXECUTION' },
      safeNextStep: 'Approval first.',
      evidence: { confidence: 'MEDIUM', missing: [] }
    })
  });

  assert.strictEqual(executionRuntime.response, 'I need approval before action');
  assert.strictEqual(executionRuntime.executionLayer.mode, 'ACTION_SURFACE');
  assert.strictEqual(executionRuntime.executionLayer.confirmRequired, true);
  assert.strictEqual(executionRuntime.finalDecision.approvalRequired, true);

  process.env.BRAIN_API_TOKEN = process.env.BRAIN_API_TOKEN || 'jarvis-runtime-test-token';
  const { createApp } = require('../whatsapp-server');
  const app = createApp();
  const server = app.listen(0, async () => {
    try {
      const port = server.address().port;
      const response = await postJson(port, '/jarvis/runtime', {
        input: 'Hey Jarvis, why am I building Jarvis?'
      }, process.env.BRAIN_API_TOKEN);
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.json.entryPoint, 'jarvis_runtime');
      assert.strictEqual(response.json.spokenResponse, response.json.voiceSummary);
      assert(assertJarvisSpeechSafe(response.json.voiceSummary).ok);
      assert(!/Roadmap Agent|Product Judgment Agent|Execution Operator|TASK_PLAN|APPROVE/.test(response.json.response));
      server.close(() => {
        console.log('Jarvis runtime orchestrator checks passed.');
      });
    } catch (error) {
      server.close(() => {
        throw error;
      });
    }
  });

})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function postJson(port, route, payload, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: route,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          statusCode: res.statusCode,
          json: text ? JSON.parse(text) : {}
        });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
