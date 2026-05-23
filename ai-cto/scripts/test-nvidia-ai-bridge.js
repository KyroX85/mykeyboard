const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  MODEL_ASSIGNMENT,
  createNvidiaClient,
  parseRiskLevel
} = require('../whatsapp/nvidia-nim-client');
const {
  buildAiWhatsAppPrompt,
  maybeGenerateAiWhatsAppResponse
} = require('../whatsapp/ai-whatsapp-responder');
const {
  executeAiBridge,
  buildDeepSeekFixPrompt,
  buildLlamaRiskPrompt
} = require('./ai-execution-bridge');
const { routeMessageWithAi } = require('../whatsapp/command-router');
const { ACTION_LOG_FILE } = require('../whatsapp/agent-action-log');
const { AGENT_BRAIN_DIR } = require('../whatsapp/main-agent-brain-manager');

async function run() {
  const actionLogBackup = fs.existsSync(ACTION_LOG_FILE) ? fs.readFileSync(ACTION_LOG_FILE, 'utf8') : null;
  const brainBackup = fs.existsSync(AGENT_BRAIN_DIR)
    ? new Map(fs.readdirSync(AGENT_BRAIN_DIR).map((file) => [file, fs.readFileSync(path.join(AGENT_BRAIN_DIR, file), 'utf8')]))
    : new Map();
  try {
  const calls = [];
  const mockTransport = async (request) => {
    calls.push(request);
    if (request.model === MODEL_ASSIGNMENT.llama.model) {
      return {
        choices: [{ message: { content: request.messages[0].content.includes('LOW, MEDIUM or HIGH') ? 'LOW risk' : '🎯 CTO: Yes sir, team ready da.' } }],
        usage: { total_tokens: 42 }
      };
    }
    return {
      choices: [{ message: { content: 'fixed file content\n' } }],
      usage: { total_tokens: 99 }
    };
  };

  const client = createNvidiaClient({
    deepseekKey: 'deepseek-test',
    llamaKey: 'llama-test',
    transport: mockTransport
  });

  const llama = await client.chat('llama', [{ role: 'user', content: 'hello' }]);
  assert.strictEqual(llama.model, MODEL_ASSIGNMENT.llama.model);
  const deepseek = await client.chat('deepseek', [{ role: 'user', content: 'fix file' }]);
  assert.strictEqual(deepseek.model, MODEL_ASSIGNMENT.deepseek.model);
  assert.strictEqual(calls[0].apiKey, 'llama-test');
  assert.strictEqual(calls[1].apiKey, 'deepseek-test');
  assert.strictEqual(parseRiskLevel('This is medium risk.'), 'MEDIUM');
  assert.strictEqual(parseRiskLevel('HIGH because privacy'), 'HIGH');
  assert.strictEqual(parseRiskLevel('safe low cleanup'), 'LOW');

  const prompt = buildAiWhatsAppPrompt({
    founderMessage: 'hi',
    agent: 'cto',
    state: {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: ['One risk'], approvals: [] },
      summary: { topRisk: 'One risk' }
    },
    memory: {
      recentMessages: [{ role: 'agent', summary: 'Last status' }]
    },
    roadmap: { currentPhase: 'PHASE 1 - STABILIZATION' }
  });
  assert(prompt.system.includes('Llama 3.3 70B'));
  assert(prompt.system.includes('casual English mixed with Tamil'));
  assert(prompt.user.includes('Founder message: hi'));

  const aiReply = await maybeGenerateAiWhatsAppResponse({
    founderMessage: 'hi',
    routed: { agent: 'cto', intent: 'greeting' },
    fallbackResponse: 'fallback',
    state: {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], approvals: [] }
    },
    memory: { recentMessages: [] },
    client
  });
  assert.strictEqual(aiReply.usedAi, true);
  assert(aiReply.response.includes('team ready'));

  const routedAi = await routeMessageWithAi('hi', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(routedAi.usedAi, true);
  assert(routedAi.response.includes('team ready'));

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-ai-bridge-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'README.md'), 'bad trailing   \n');
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'VISION_NORTH_STAR.md'), 'Vision: stable keyboard.');
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', '.brain_state.json'), JSON.stringify({
      healthScore: 80,
      unresolvedIssues: [{
        type: 'FORMATTING',
        message: 'Trailing whitespace in README.md',
        file: 'README.md'
      }]
    }, null, 2));
    execFileSync('git', ['init'], { cwd: tempRoot });
    execFileSync('git', ['config', 'user.email', 'cto-test@example.com'], { cwd: tempRoot });
    execFileSync('git', ['config', 'user.name', 'CTO Test'], { cwd: tempRoot });
    execFileSync('git', ['add', '.'], { cwd: tempRoot });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: tempRoot });

    const riskPrompt = buildLlamaRiskPrompt({ message: 'Trailing whitespace', file: 'README.md' });
    assert(riskPrompt.includes('LOW, MEDIUM or HIGH'));
    const fixPrompt = buildDeepSeekFixPrompt({
      file: 'README.md',
      issue: { message: 'Trailing whitespace' },
      content: 'bad trailing   \n',
      vision: 'Vision'
    });
    assert(fixPrompt.includes('Fix only this specific issue'));
    assert(fixPrompt.includes('Return only the complete fixed file content'));

    const bridge = await executeAiBridge({
      root: tempRoot,
      client,
      commit: false,
      push: false,
      validationCommand: [process.execPath, '-e', "require('fs').readFileSync('README.md','utf8').includes('fixed') || process.exit(1)"]
    });
    assert.strictEqual(bridge.status, 'COMPLETED');
    assert.strictEqual(bridge.riskLevel, 'LOW');
    assert.strictEqual(bridge.modelUsed.fix, MODEL_ASSIGNMENT.deepseek.model);
    assert(fs.readFileSync(path.join(tempRoot, 'README.md'), 'utf8').includes('fixed file content'));
    const log = JSON.parse(fs.readFileSync(path.join(tempRoot, 'ai-cto', 'agent-action-log.json'), 'utf8'));
    assert(log.actions.some((entry) => entry.modelUsed === MODEL_ASSIGNMENT.deepseek.model));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  } finally {
    if (actionLogBackup == null) {
      if (fs.existsSync(ACTION_LOG_FILE)) fs.unlinkSync(ACTION_LOG_FILE);
    } else {
      fs.writeFileSync(ACTION_LOG_FILE, actionLogBackup);
    }
    if (fs.existsSync(AGENT_BRAIN_DIR)) {
      for (const file of fs.readdirSync(AGENT_BRAIN_DIR)) {
        const full = path.join(AGENT_BRAIN_DIR, file);
        if (brainBackup.has(file)) fs.writeFileSync(full, brainBackup.get(file));
        else fs.unlinkSync(full);
      }
    }
  }
}

run().then(() => {
  console.log('NVIDIA AI bridge checks passed.');
});
