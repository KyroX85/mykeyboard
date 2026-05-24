const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  MODEL_ASSIGNMENT,
  createNvidiaClient,
  parseRiskLevel,
  STRICT_GUARDRAIL_PROMPT,
  ENDPOINT,
  defaultTransport
} = require('../whatsapp/nvidia-nim-client');
const {
  buildAiWhatsAppPrompt,
  maybeGenerateAiWhatsAppResponse
} = require('../whatsapp/ai-whatsapp-responder');
const {
  executeAiBridge,
  buildDeepSeekFixPrompt,
  buildLlamaRiskPrompt,
  diffWithinHardLimits,
  configureGitRemote,
  ensureGitRuntime
} = require('./ai-execution-bridge');
const { routeMessageWithAi } = require('../whatsapp/command-router');
const { ACTION_LOG_FILE } = require('../whatsapp/agent-action-log');
const { AGENT_BRAIN_DIR } = require('../whatsapp/main-agent-brain-manager');
const {
  VISION_COMMAND_LOG_FILE,
  readVisionCommandState
} = require('../whatsapp/vision-command-manager');
const {
  FOUNDER_MEMORY_FILE,
  readPendingVisionCommand,
  clearPendingVisionCommand
} = require('../whatsapp/founder-memory');

async function run() {
  const actionLogBackup = fs.existsSync(ACTION_LOG_FILE) ? fs.readFileSync(ACTION_LOG_FILE, 'utf8') : null;
  const visionLogBackup = fs.existsSync(VISION_COMMAND_LOG_FILE) ? fs.readFileSync(VISION_COMMAND_LOG_FILE, 'utf8') : null;
  const founderMemoryBackup = fs.existsSync(FOUNDER_MEMORY_FILE) ? fs.readFileSync(FOUNDER_MEMORY_FILE, 'utf8') : null;
  const githubTokenBackup = process.env.GITHUB_TOKEN;
  const brainBackup = fs.existsSync(AGENT_BRAIN_DIR)
    ? new Map(fs.readdirSync(AGENT_BRAIN_DIR).map((file) => [file, fs.readFileSync(path.join(AGENT_BRAIN_DIR, file), 'utf8')]))
    : new Map();
  try {
  delete process.env.GITHUB_TOKEN;
  const calls = [];
  const mockTransport = async (request) => {
    calls.push(request);
    assert.strictEqual(request.messages[0].role, 'system');
    assert(request.messages[0].content.startsWith(STRICT_GUARDRAIL_PROMPT));
    if (request.model === MODEL_ASSIGNMENT.llama.model) {
      const joined = request.messages.map((message) => message.content).join('\n');
      if (joined.includes('Classify this founder WhatsApp message')) {
        return {
          choices: [{ message: { content: 'VISION_COMMAND' } }],
          usage: { total_tokens: 21 }
        };
      }
      if (joined.includes('Break this founder vision command')) {
        if (joined.includes('Hello.kt')) {
          return {
            choices: [{ message: { content: JSON.stringify({
              task: 'Create test file Hello.kt',
              files: ['app/src/main/java/Hello.kt'],
              changes: ['Create the requested Kotlin test file'],
              risk: 'LOW',
              estimatedLines: 3,
              roadmapConflict: false
            }) } }],
            usage: { total_tokens: 57 }
          };
        }
        return {
          choices: [{ message: { content: JSON.stringify({
            task: 'Improve keyboard key responsiveness safely',
            files: ['README.md'],
            changes: ['Document responsiveness validation plan only'],
            risk: 'LOW',
            estimatedLines: 4,
            roadmapConflict: false
          }) } }],
          usage: { total_tokens: 55 }
        };
      }
      return {
        choices: [{ message: { content: joined.includes('LOW, MEDIUM or HIGH') ? 'LOW risk' : 'Health is at 80. No critical issues. What would you like to prioritize today?' } }],
        usage: { total_tokens: 42 }
      };
    }
    return {
      choices: [{ message: { content: request.messages.map((message) => message.content).join('\n').includes('Hello.kt') ? '// Pipeline test file for CTO execution.\n' : 'fixed file content\n' } }],
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
  assert(calls[0].messages[0].content.startsWith(STRICT_GUARDRAIL_PROMPT));
  assert.strictEqual(parseRiskLevel('This is medium risk.'), 'MEDIUM');
  assert.strictEqual(parseRiskLevel('HIGH because privacy'), 'HIGH');
  assert.strictEqual(parseRiskLevel('safe low cleanup'), 'LOW');
  assert.strictEqual(MODEL_ASSIGNMENT.deepseek.model, 'deepseek-ai/deepseek-v4-flash');
  assert.strictEqual(MODEL_ASSIGNMENT.llama.model, 'meta/llama-3.3-70b-instruct');

  const originalFetch = global.fetch;
  try {
    let capturedRequest = null;
    global.fetch = async (url, request) => {
      capturedRequest = { url, request };
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 1 } })
      };
    };
    await defaultTransport({
      endpoint: ENDPOINT,
      apiKey: 'test-api-key',
      model: MODEL_ASSIGNMENT.deepseek.model,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      maxTokens: 1024
    });
    assert.strictEqual(capturedRequest.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.strictEqual(capturedRequest.request.headers.Authorization, 'Bearer test-api-key');
    assert.strictEqual(capturedRequest.request.headers['Content-Type'], 'application/json');
    const body = JSON.parse(capturedRequest.request.body);
    assert.strictEqual(body.model, 'deepseek-ai/deepseek-v4-flash');
    assert.strictEqual(body.max_tokens, 1024);
  } finally {
    global.fetch = originalFetch;
  }

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
      recentMessages: Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? 'agent' : 'founder',
        summary: `Message ${index}`,
        founderMessage: index === 10 ? 'create a test file called Hello.kt' : null
      }))
    },
    roadmap: { currentPhase: 'PHASE 1 - STABILIZATION' }
  });
  assert(prompt.system.includes('Llama 3.3 70B'));
  assert(prompt.system.includes('English only'));
  assert(prompt.system.includes('startup CTO reporting to their CEO'));
  assert(prompt.system.includes('Address the founder as Founder'));
  assert(prompt.system.includes('Do not use Tamil words'));
  assert(!/Tamil mixed|Tamil naturally/i.test(prompt.system));
  assert(prompt.user.includes('Founder message: hi'));
  assert(prompt.user.includes('create a test file called Hello.kt'));
  assert.strictEqual((prompt.user.match(/Message /g) || []).length, 10);

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
  assert(aiReply.response.includes('Health is at 80'));

  const routedAi = await routeMessageWithAi('hi', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(routedAi.usedAi, true);
  assert(routedAi.response.includes('What would you like to prioritize'));

  if (fs.existsSync(VISION_COMMAND_LOG_FILE)) fs.unlinkSync(VISION_COMMAND_LOG_FILE);
  clearPendingVisionCommand();
  const noPendingApproval = await routeMessageWithAi('YES', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(noPendingApproval.command, 'vision_command_missing');
  assert(noPendingApproval.response.includes('no pending vision command'));

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
    const diffCheck = diffWithinHardLimits(tempRoot, { maxFiles: 3, maxLines: 50 });
    assert.strictEqual(diffCheck.allowed, true);

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

    fs.writeFileSync(path.join(tempRoot, 'README.md'), Array.from({ length: 60 }, (_, index) => `line ${index}`).join('\n'));
    const blockedDiff = diffWithinHardLimits(tempRoot, { maxFiles: 3, maxLines: 50 });
    assert.strictEqual(blockedDiff.allowed, false);
    assert(blockedDiff.reason.includes('50 lines'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const tempRemoteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-remote-'));
  try {
    execFileSync('git', ['init'], { cwd: tempRemoteRoot });
    process.env.GITHUB_TOKEN = 'test-token';
    ensureGitRuntime(tempRemoteRoot);
    configureGitRemote(tempRemoteRoot);
    assert.strictEqual(execFileSync('git', ['config', 'user.email'], { cwd: tempRemoteRoot, encoding: 'utf8' }).trim(), 'cto@aritenis.ai');
    assert.strictEqual(execFileSync('git', ['config', 'user.name'], { cwd: tempRemoteRoot, encoding: 'utf8' }).trim(), 'Aritenis CTO');
    assert.strictEqual(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: tempRemoteRoot, encoding: 'utf8' }).trim(), 'https://test-token@github.com/KyroX85/mykeyboard.git');
  } finally {
    delete process.env.GITHUB_TOKEN;
    fs.rmSync(tempRemoteRoot, { recursive: true, force: true });
  }

  const visionPlan = await routeMessageWithAi('make keyboard keys feel more responsive', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(visionPlan.command, 'vision_command_pending');
  assert(visionPlan.response.includes('Reply YES to execute or NO to cancel'));
  const visionState = readVisionCommandState();
  assert(visionState.pending);
  assert.strictEqual(visionState.pending.command, 'make keyboard keys feel more responsive');

  const visionNo = await routeMessageWithAi('NO', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client, commit: false });
  assert.strictEqual(visionNo.command, 'vision_command_cancelled');
  assert(visionNo.response.toLowerCase().includes('cancelled'));

  const tempRootForVision = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-vision-test-'));
  try {
    fs.mkdirSync(path.join(tempRootForVision, 'ai-cto'), { recursive: true });
    fs.writeFileSync(path.join(tempRootForVision, 'ai-cto', 'VISION_NORTH_STAR.md'), 'Vision: stable keyboard.');
    fs.writeFileSync(path.join(tempRootForVision, 'ai-cto', '.brain_state.json'), JSON.stringify({
      healthScore: 80,
      unresolvedIssues: []
    }, null, 2));
    execFileSync('git', ['init'], { cwd: tempRootForVision });
    execFileSync('git', ['config', 'user.email', 'cto-test@example.com'], { cwd: tempRootForVision });
    execFileSync('git', ['config', 'user.name', 'CTO Test'], { cwd: tempRootForVision });
    execFileSync('git', ['add', '.'], { cwd: tempRootForVision });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: tempRootForVision });

    const helloPlan = await routeMessageWithAi('create a test file called Hello.kt', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, { client });
    assert.strictEqual(helloPlan.command, 'vision_command_pending');
    assert(readPendingVisionCommand());
    if (fs.existsSync(VISION_COMMAND_LOG_FILE)) fs.unlinkSync(VISION_COMMAND_LOG_FILE);
    const helloRun = await routeMessageWithAi('ok go ahead', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [{ role: 'agent', summary: 'Planned Hello.kt creation.' }] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false,
      commitMessage: 'test: Hello.kt pipeline test',
      validationCommand: [process.execPath, '-e', "require('fs').existsSync('app/src/main/java/Hello.kt') || process.exit(1)"]
    });
    assert.strictEqual(helloRun.command, 'vision_command_approved');
    assert(helloRun.response.includes('Commit:'));
    assert(fs.existsSync(path.join(tempRootForVision, 'app', 'src', 'main', 'java', 'Hello.kt')));
    assert(execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRootForVision, encoding: 'utf8' }).includes('test: Hello.kt pipeline test'));
  } finally {
    fs.rmSync(tempRootForVision, { recursive: true, force: true });
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
    if (visionLogBackup == null) {
      if (fs.existsSync(VISION_COMMAND_LOG_FILE)) fs.unlinkSync(VISION_COMMAND_LOG_FILE);
    } else {
      fs.writeFileSync(VISION_COMMAND_LOG_FILE, visionLogBackup);
    }
    if (founderMemoryBackup == null) {
      if (fs.existsSync(FOUNDER_MEMORY_FILE)) fs.unlinkSync(FOUNDER_MEMORY_FILE);
    } else {
      fs.writeFileSync(FOUNDER_MEMORY_FILE, founderMemoryBackup);
    }
    if (githubTokenBackup == null) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = githubTokenBackup;
  }
}

run().then(() => {
  console.log('NVIDIA AI bridge checks passed.');
});
