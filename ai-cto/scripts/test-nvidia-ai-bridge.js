const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-nvidia-action-log.json');
process.env.ARITENIS_FOUNDER_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-nvidia-founder-memory.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-nvidia-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-nvidia-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-nvidia-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-nvidia-governance-state.json');

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
  getDeepSeekFixLimitStatus,
  configureGitRemote,
  ensureGitRuntime,
  syncWithRemoteMain
} = require('./ai-execution-bridge');
const { routeMessageWithAi } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');
const { ACTION_LOG_FILE } = require('../whatsapp/agent-action-log');
const { AGENT_BRAIN_DIR } = require('../whatsapp/main-agent-brain-manager');
const {
  VISION_COMMAND_LOG_FILE,
  readVisionCommandState,
  normalizePlan,
  isProtectedProductFile
} = require('../whatsapp/vision-command-manager');
const {
  FOUNDER_MEMORY_FILE
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
        if (/\b(remove|delete)\b/i.test(joined) && joined.includes('Hello.kt')) {
          return {
            choices: [{ message: { content: JSON.stringify({
              task: 'Remove test file Hello.kt',
              files: ['app/src/main/java/Hello.kt'],
              changes: ['Remove the requested Kotlin test file'],
              risk: 'LOW',
              estimatedLines: 1,
              roadmapConflict: false
            }) } }],
            usage: { total_tokens: 57 }
          };
        }
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
              risk: 'MEDIUM',
              estimatedLines: 24,
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
    qwenCoderKey: 'qwen-test',
    llamaKey: 'llama-test',
    transport: mockTransport
  });

  const llama = await client.chat('llama', [{ role: 'user', content: 'hello' }]);
  assert.strictEqual(llama.model, MODEL_ASSIGNMENT.llama.model);
  const deepseek = await client.chat('deepseek', [{ role: 'user', content: 'fix file' }]);
  assert.strictEqual(deepseek.model, MODEL_ASSIGNMENT.deepseek.model);
  const qwenCoder = await client.chat('qwenCoder', [{ role: 'user', content: 'fix fallback file' }]);
  assert.strictEqual(qwenCoder.model, MODEL_ASSIGNMENT.qwenCoder.model);
  assert.strictEqual(calls[0].apiKey, 'llama-test');
  assert.strictEqual(calls[1].apiKey, 'deepseek-test');
  assert.strictEqual(calls[2].apiKey, 'qwen-test');
  assert(calls[0].messages[0].content.startsWith(STRICT_GUARDRAIL_PROMPT));
  assert.strictEqual(parseRiskLevel('This is medium risk.'), 'MEDIUM');
  assert.strictEqual(parseRiskLevel('HIGH because privacy'), 'HIGH');
  assert.strictEqual(parseRiskLevel('safe low cleanup'), 'LOW');
  assert.strictEqual(MODEL_ASSIGNMENT.deepseek.model, 'deepseek-ai/deepseek-v4-flash');
  assert.strictEqual(MODEL_ASSIGNMENT.qwenCoder.model, 'qwen/qwen3-coder-480b-a35b-instruct');
  assert.strictEqual(MODEL_ASSIGNMENT.llama.model, 'meta/llama-3.3-70b-instruct');
  assert.strictEqual(getDeepSeekFixLimitStatus(process.cwd()).limit, 20);
  const inferredHelloPlan = normalizePlan({
    task: 'Create a test file called Hello.kt',
    files: [],
    changes: ['Create requested file'],
    risk: 'HIGH',
    estimatedLines: 3
  }, 'create a test file called Hello.kt');
  assert.deepStrictEqual(inferredHelloPlan.files, ['app/src/main/java/Hello.kt']);
  assert.strictEqual(inferredHelloPlan.risk, 'LOW');
  const forbiddenCreatePlan = normalizePlan({
    task: 'Create a secret file',
    files: ['ai-cto/secret-key.json'],
    changes: ['Create requested file'],
    risk: 'LOW',
    estimatedLines: 3
  }, 'create a secret file called secret-key.json');
  assert.strictEqual(forbiddenCreatePlan.risk, 'HIGH');
  assert.strictEqual(isProtectedProductFile('app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt'), true);
  assert.strictEqual(isProtectedProductFile('app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt'), true);
  const protectedPlan = normalizePlan({
    task: 'Improve swipe reliability',
    files: ['app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt'],
    changes: ['Tune resolver scoring'],
    risk: 'LOW',
    estimatedLines: 8
  }, 'improve swipe reliability');
  assert.strictEqual(protectedPlan.risk, 'MEDIUM');

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
      apiKey: ['test', 'api', 'key'].join('-'),
      model: MODEL_ASSIGNMENT.deepseek.model,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      maxTokens: 1024
    });
    assert.strictEqual(capturedRequest.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.strictEqual(capturedRequest.request.headers.Authorization, `Bearer ${['test', 'api', 'key'].join('-')}`);
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
  assert.strictEqual(routedAi.usedAi, false);
  assert.strictEqual(routedAi.aiReason, 'deterministic greeting fast path');
  assert(routedAi.response.includes('What would you like to prioritize'));

  const routedLowInfo = await routeMessageWithAi('banana quantum potato', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(routedLowInfo.command, 'noise_signal_ignored');
  assert.strictEqual(routedLowInfo.usedAi, false);
  assert(routedLowInfo.response.includes('NOISE / STRESS TEST DETECTED'));
  assert(!routedLowInfo.response.includes('Options:'));

  const preservationMode = await routeMessageWithAi('enter preservation mode', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client, deferLowRiskVisionExecution: true });
  assert.strictEqual(preservationMode.command, 'preservation_mode_enabled');
  assert.strictEqual(preservationMode.usedAi, false);
  assert(!preservationMode.response.includes('Starting execution now'));
  const preservationCreate = await routeMessageWithAi('create a file called preservation_test.txt', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client, deferLowRiskVisionExecution: true });
  assert.strictEqual(preservationCreate.command, 'preservation_mode_blocked');
  assert.strictEqual(preservationCreate.usedAi, false);
  assert(preservationCreate.response.includes('BLOCKED'));
  const preservationOff = await routeMessageWithAi('disable preservation mode', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client, deferLowRiskVisionExecution: true });
  assert.strictEqual(preservationOff.command, 'preservation_mode_disabled');
  assert.strictEqual(preservationOff.usedAi, false);
  setMode('ACTIVE', 'test reset');

  const priorityChoice = await routeMessageWithAi('what should we improve next: architecture cleanup or swipe trust?', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(priorityChoice.command, 'product_priority_answer');
  assert.strictEqual(priorityChoice.usedAi, false);
  assert(priorityChoice.response.includes('Evidence checked:'));
  assert(priorityChoice.response.includes('Evidence gap:'));
  assert(!priorityChoice.response.includes('Options:'));

  const operationalRiskSummary = await routeMessageWithAi('summarize today’s operational risks honestly', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(operationalRiskSummary.command, 'operational_risk_summary');
  assert.strictEqual(operationalRiskSummary.usedAi, false);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-ai-bridge-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'ai-cto'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'README.md'), 'bad trailing   \n');
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'VISION_NORTH_STAR.md'), 'Vision: stable keyboard.');
    const baselineActionLog = JSON.stringify({ version: '1.0', actions: [] }, null, 2) + '\n';
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'agent-action-log.json'), baselineActionLog);
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
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'agent-action-log.json'), JSON.stringify({
      version: '1.0',
      actions: Array.from({ length: 80 }, (_, index) => ({
        timestamp: `2026-05-25T00:${String(index).padStart(2, '0')}:00.000Z`,
        actionTaken: `test operational action ${index}`
      }))
    }, null, 2) + '\n');
    fs.mkdirSync(path.join(tempRoot, 'app', 'src', 'main', 'java'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'app', 'src', 'main', 'java', 'Hello.kt'), '// Pipeline test file.\n');
    const operationalDiff = diffWithinHardLimits(tempRoot, { maxFiles: 3, maxLines: 50 });
    assert.strictEqual(operationalDiff.allowed, true);
    assert.strictEqual(operationalDiff.filesChanged, 1);
    assert.strictEqual(operationalDiff.newFilesChanged, 1);
    assert(operationalDiff.ignoredFilesChanged >= 1);
    fs.writeFileSync(path.join(tempRoot, 'ai-cto', 'agent-action-log.json'), baselineActionLog);
    fs.rmSync(path.join(tempRoot, 'app'), { recursive: true, force: true });
    for (let index = 0; index < 4; index += 1) {
      fs.writeFileSync(path.join(tempRoot, `NewFile${index}.txt`), `new ${index}\n`);
    }
    const newFilesDiff = diffWithinHardLimits(tempRoot, { maxFiles: 3, maxLines: 50 });
    assert.strictEqual(newFilesDiff.allowed, true);
    assert.strictEqual(newFilesDiff.existingFilesChanged, 0);
    assert.strictEqual(newFilesDiff.newFilesChanged, 4);
    for (let index = 0; index < 4; index += 1) {
      fs.rmSync(path.join(tempRoot, `NewFile${index}.txt`), { force: true });
    }
    fs.writeFileSync(path.join(tempRoot, 'LargeNewFile.txt'), Array.from({ length: 80 }, (_, index) => `new line ${index}`).join('\n'));
    const largeNewFileDiff = diffWithinHardLimits(tempRoot, { maxFiles: 3, maxLines: 50 });
    assert.strictEqual(largeNewFileDiff.allowed, true);
    assert.strictEqual(largeNewFileDiff.existingLinesChanged, 0);
    assert.strictEqual(largeNewFileDiff.newFileLinesChanged, 80);
    fs.rmSync(path.join(tempRoot, 'LargeNewFile.txt'), { force: true });
    fs.writeFileSync(path.join(tempRoot, 'HugeStaleFailedAttempt.kt'), Array.from({ length: 350 }, (_, index) => `// stale ${index}`).join('\n'));
    fs.mkdirSync(path.join(tempRoot, 'app', 'src', 'main', 'java'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'app', 'src', 'main', 'java', 'Hello.kt'), '// Pipeline test file.\n');
    const scopedDiff = diffWithinHardLimits(tempRoot, {
      maxFiles: 3,
      maxLines: 50,
      allowedFiles: ['app/src/main/java/Hello.kt']
    });
    assert.strictEqual(scopedDiff.allowed, true);
    assert.strictEqual(scopedDiff.filesChanged, 1);
    assert.strictEqual(scopedDiff.newFilesChanged, 1);
    fs.rmSync(path.join(tempRoot, 'HugeStaleFailedAttempt.kt'), { force: true });
    fs.rmSync(path.join(tempRoot, 'app'), { recursive: true, force: true });

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
    execFileSync('git', ['add', '.'], { cwd: tempRoot });
    execFileSync('git', ['commit', '-m', 'baseline after deepseek fixture'], { cwd: tempRoot });

    const fallbackCalls = [];
    const fallbackClient = createNvidiaClient({
      deepseekKey: 'deepseek-test',
      qwenCoderKey: 'qwen-test',
      llamaKey: 'llama-test',
      transport: async (request) => {
        fallbackCalls.push(request);
        const joined = request.messages.map((message) => message.content).join('\n');
        if (request.model === MODEL_ASSIGNMENT.llama.model) {
          return {
            choices: [{ message: { content: joined.includes('LOW, MEDIUM or HIGH') ? 'LOW risk' : 'APPROVED' } }],
            usage: { total_tokens: 1 }
          };
        }
        if (request.model === MODEL_ASSIGNMENT.deepseek.model) {
          throw new Error('NVIDIA NIM 429: quota exceeded');
        }
        return {
          choices: [{ message: { content: 'fallback fixed file content\n' } }],
          usage: { total_tokens: 2 }
        };
      }
    });
    fs.writeFileSync(path.join(tempRoot, 'README.md'), 'needs fallback\n');
    const fallbackBridge = await executeAiBridge({
      root: tempRoot,
      client: fallbackClient,
      commit: false,
      push: false,
      validationCommand: [process.execPath, '-e', "require('fs').readFileSync('README.md','utf8').includes('fallback fixed') || process.exit(1)"]
    });
    assert.strictEqual(fallbackBridge.status, 'COMPLETED');
    assert.strictEqual(fallbackBridge.modelUsed.fix, MODEL_ASSIGNMENT.qwenCoder.model);
    assert(fallbackCalls.some((request) => request.model === MODEL_ASSIGNMENT.deepseek.model));
    assert(fallbackCalls.some((request) => request.model === MODEL_ASSIGNMENT.qwenCoder.model));

    fs.writeFileSync(path.join(tempRoot, 'README.md'), Array.from({ length: 60 }, (_, index) => `line ${index}`).join('\n'));
    const blockedDiff = diffWithinHardLimits(tempRoot, { maxFiles: 3, maxLines: 50 });
    assert.strictEqual(blockedDiff.allowed, false);
    assert(blockedDiff.reason.includes('50 lines'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const tempMediumRiskRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-medium-risk-'));
  try {
    fs.mkdirSync(path.join(tempMediumRiskRoot, 'ai-cto', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tempMediumRiskRoot, 'ai-cto', 'scripts', 'ai-execution-bridge.js'), 'large file\n');
    fs.writeFileSync(path.join(tempMediumRiskRoot, 'ai-cto', '.brain_state.json'), JSON.stringify({
      healthScore: 55,
      unresolvedIssues: [{
        type: 'COMPLEXITY',
        impact: 'MEDIUM',
        message: 'File ai-execution-bridge.js is too large (>500 lines)',
        file: 'ai-cto/scripts/ai-execution-bridge.js'
      }]
    }, null, 2));
    const callsBeforeMediumRisk = calls.length;
    const mediumRiskBridge = await executeAiBridge({
      root: tempMediumRiskRoot,
      client,
      commit: false,
      push: false
    });
    assert.strictEqual(mediumRiskBridge.status, 'STAGING_REQUIRED');
    assert.strictEqual(mediumRiskBridge.riskLevel, 'MEDIUM');
    assert.strictEqual(calls.length, callsBeforeMediumRisk);
  } finally {
    fs.rmSync(tempMediumRiskRoot, { recursive: true, force: true });
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

  const tempBareRemote = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-bare-remote-'));
  const tempStaleClone = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-stale-clone-'));
  const tempRemoteWriter = fs.mkdtempSync(path.join(os.tmpdir(), 'cto-remote-writer-'));
  try {
    execFileSync('git', ['init', '--bare'], { cwd: tempBareRemote });
    execFileSync('git', ['init', '-b', 'main'], { cwd: tempStaleClone });
    execFileSync('git', ['config', 'user.email', 'cto-test@example.com'], { cwd: tempStaleClone });
    execFileSync('git', ['config', 'user.name', 'CTO Test'], { cwd: tempStaleClone });
    fs.writeFileSync(path.join(tempStaleClone, 'README.md'), 'base\n');
    execFileSync('git', ['add', '.'], { cwd: tempStaleClone });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: tempStaleClone });
    execFileSync('git', ['remote', 'add', 'origin', tempBareRemote], { cwd: tempStaleClone });
    execFileSync('git', ['push', 'origin', 'main'], { cwd: tempStaleClone });

    execFileSync('git', ['clone', tempBareRemote, tempRemoteWriter]);
    execFileSync('git', ['switch', 'main'], { cwd: tempRemoteWriter });
    execFileSync('git', ['config', 'user.email', 'cto-test@example.com'], { cwd: tempRemoteWriter });
    execFileSync('git', ['config', 'user.name', 'CTO Test'], { cwd: tempRemoteWriter });
    fs.writeFileSync(path.join(tempRemoteWriter, 'memory.txt'), 'github-api memory commit\n');
    execFileSync('git', ['add', '.'], { cwd: tempRemoteWriter });
    execFileSync('git', ['commit', '-m', 'remote memory commit'], { cwd: tempRemoteWriter });
    execFileSync('git', ['push', 'origin', 'main'], { cwd: tempRemoteWriter });

    fs.writeFileSync(path.join(tempStaleClone, 'Hello.kt'), '// local execution commit\n');
    execFileSync('git', ['add', '.'], { cwd: tempStaleClone });
    execFileSync('git', ['commit', '-m', 'test: Hello.kt pipeline test'], { cwd: tempStaleClone });
    fs.writeFileSync(path.join(tempStaleClone, 'runtime-dirty.log'), 'render runtime dirty file\n');
    syncWithRemoteMain(tempStaleClone);
    execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: tempStaleClone });
    assert(fs.existsSync(path.join(tempStaleClone, 'runtime-dirty.log')));
    const remoteLog = execFileSync('git', ['--git-dir', tempBareRemote, 'log', '--oneline', '-2', 'main'], { encoding: 'utf8' });
    assert(remoteLog.includes('test: Hello.kt pipeline test'));
    assert(remoteLog.includes('remote memory commit'));
  } finally {
    fs.rmSync(tempBareRemote, { recursive: true, force: true });
    fs.rmSync(tempStaleClone, { recursive: true, force: true });
    fs.rmSync(tempRemoteWriter, { recursive: true, force: true });
  }

  const visionPlan = await routeMessageWithAi('make keyboard keys feel more responsive', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(visionPlan.command, 'product_improvement_review_required');
  assert(visionPlan.response.includes('protected product code'));
  assert(visionPlan.response.includes('staging-branch patch'));

  const swipeProposal = await routeMessageWithAi('improve swipe reliability', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(swipeProposal.command, 'product_improvement_review_required');
  assert(swipeProposal.response.includes('SwipeGestureTracker.kt'));
  assert(swipeProposal.response.includes('Options:'));

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
    const approvePlan = async (planned, extraOptions = {}) => {
      assert.strictEqual(planned.command, 'vision_command_approval_required');
      assert(planned.response.includes('No execution started'));
      const approval = planned.response.match(/APPROVE-[A-Za-z0-9_-]+/);
      assert(approval, planned.response);
      return routeMessageWithAi(approval[0], {
        healthScore: 80,
        momentum: 'MOVING',
        sections: { risks: [], unresolved: [], approvals: [] },
        summary: { topRisk: 'none' }
      }, { recentMessages: [] }, {
        client,
        root: tempRootForVision,
        commit: true,
        push: false,
        ...extraOptions
      });
    };

    const llamaVerifyCallsBeforeHello = calls.filter((request) =>
      request.model === MODEL_ASSIGNMENT.llama.model &&
      request.messages.map((message) => message.content).join('\n').includes('Verify whether this fix makes logical sense')
    ).length;
    const codeBrainCallsBeforeHello = calls.filter((request) =>
      request.model === MODEL_ASSIGNMENT.deepseek.model ||
      request.model === MODEL_ASSIGNMENT.qwenCoder.model
    ).length;
    const helloPlan = await routeMessageWithAi('create a test file called Hello.kt', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false,
      commitMessage: 'test: Hello.kt pipeline test',
      validationCommand: [process.execPath, '-e', "require('fs').existsSync('app/src/main/java/Hello.kt') || process.exit(1)"]
    });
    const helloResult = await approvePlan(helloPlan, {
      commitMessage: 'test: Hello.kt pipeline test',
      validationCommand: [process.execPath, '-e', "require('fs').existsSync('app/src/main/java/Hello.kt') || process.exit(1)"]
    });
    assert.strictEqual(helloResult.command, 'vision_command_approved');
    assert(helloResult.response.includes('Commit:'));
    const llamaVerifyCallsAfterHello = calls.filter((request) =>
      request.model === MODEL_ASSIGNMENT.llama.model &&
      request.messages.map((message) => message.content).join('\n').includes('Verify whether this fix makes logical sense')
    ).length;
    const codeBrainCallsAfterHello = calls.filter((request) =>
      request.model === MODEL_ASSIGNMENT.deepseek.model ||
      request.model === MODEL_ASSIGNMENT.qwenCoder.model
    ).length;
    assert.strictEqual(llamaVerifyCallsAfterHello, llamaVerifyCallsBeforeHello);
    assert.strictEqual(codeBrainCallsAfterHello, codeBrainCallsBeforeHello);
    assert(fs.existsSync(path.join(tempRootForVision, 'app', 'src', 'main', 'java', 'Hello.kt')));
    assert(execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRootForVision, encoding: 'utf8' }).includes('test: Hello.kt pipeline test'));

    const codeBrainCallsBeforeDelete = calls.filter((request) =>
      request.model === MODEL_ASSIGNMENT.deepseek.model ||
      request.model === MODEL_ASSIGNMENT.qwenCoder.model
    ).length;
    const deleteHello = await routeMessageWithAi('remove the test file called Hello.kt', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false,
      commitMessage: 'test: remove Hello.kt pipeline test'
    });
    const codeBrainCallsAfterDelete = calls.filter((request) =>
      request.model === MODEL_ASSIGNMENT.deepseek.model ||
      request.model === MODEL_ASSIGNMENT.qwenCoder.model
    ).length;
    const deleteHelloResult = await approvePlan(deleteHello, {
      commitMessage: 'test: remove Hello.kt pipeline test'
    });
    assert.strictEqual(deleteHelloResult.command, 'vision_command_approved');
    assert(deleteHelloResult.response.includes('Commit:'));
    assert.strictEqual(codeBrainCallsAfterDelete, codeBrainCallsBeforeDelete);
    assert(!fs.existsSync(path.join(tempRootForVision, 'app', 'src', 'main', 'java', 'Hello.kt')));
    assert(execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRootForVision, encoding: 'utf8' }).includes('test: remove Hello.kt pipeline test'));

    const deleteAbsentHello = await routeMessageWithAi('remove the test file called Hello.kt', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false,
      commitMessage: 'test: remove Hello.kt pipeline test'
    });
    const deleteAbsentHelloResult = await approvePlan(deleteAbsentHello, {
      commitMessage: 'test: remove Hello.kt pipeline test'
    });
    assert.strictEqual(deleteAbsentHelloResult.command, 'vision_command_approved');
    assert(deleteAbsentHelloResult.response.includes('already clean'));
    assert(deleteAbsentHelloResult.response.includes('Commit: not needed'));

    fs.writeFileSync(path.join(tempRootForVision, 'app', 'src', 'main', 'java', 'Hello.kt'), '// Pipeline test file for CTO execution.\n');
    execFileSync('git', ['add', '.'], { cwd: tempRootForVision });
    execFileSync('git', ['commit', '-m', 'test: restore Hello.kt for loose delete test'], { cwd: tempRootForVision });
    const llamaCallsBeforeLooseDelete = calls.filter((request) => request.model === MODEL_ASSIGNMENT.llama.model).length;
    const looseDelete = await routeMessageWithAi('remove the test file called hellokt', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false,
      commitMessage: 'test: remove Hello.kt pipeline test'
    });
    const llamaCallsAfterLooseDelete = calls.filter((request) => request.model === MODEL_ASSIGNMENT.llama.model).length;
    const looseDeleteResult = await approvePlan(looseDelete, {
      commitMessage: 'test: remove Hello.kt pipeline test'
    });
    assert.strictEqual(looseDeleteResult.command, 'vision_command_approved');
    assert(looseDeleteResult.response.includes('Commit:'));
    assert.strictEqual(llamaCallsAfterLooseDelete, llamaCallsBeforeLooseDelete);
    assert(!fs.existsSync(path.join(tempRootForVision, 'app', 'src', 'main', 'java', 'Hello.kt')));

    const deferredHello = await routeMessageWithAi('create a test file called Hello.kt', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false,
      deferLowRiskVisionExecution: true
    });
    assert.strictEqual(deferredHello.command, 'vision_command_approval_required');
    assert(deferredHello.response.includes('No execution started'));
    assert(deferredHello.response.includes('APPROVE-'));

    const swipeNotesPath = path.join(tempRootForVision, 'app', 'src', 'main', 'java', 'SwipeReliabilityNotes.kt');
    fs.mkdirSync(path.dirname(swipeNotesPath), { recursive: true });
    fs.writeFileSync(swipeNotesPath, '// Existing swipe reliability notes.\n');
    execFileSync('git', ['add', '.'], { cwd: tempRootForVision });
    execFileSync('git', ['commit', '-m', 'test: existing swipe reliability notes'], { cwd: tempRootForVision });
    const duplicateCreate = await routeMessageWithAi('make a file SwipeReliabilityNotes.kt in repo to improve swipe reliability', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false
    });
    const duplicateCreateResult = await approvePlan(duplicateCreate);
    assert.strictEqual(duplicateCreateResult.command, 'vision_command_approved');
    assert(duplicateCreateResult.response.includes('already exists'));
    assert(duplicateCreateResult.response.includes('Append notes'));
    assert(execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRootForVision, encoding: 'utf8' }).includes('test: existing swipe reliability notes'));
    const duplicateOption3 = await routeMessageWithAi('3', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false
    });
    assert.strictEqual(duplicateOption3.command, 'duplicate_target_leave_unchanged');
    assert(duplicateOption3.response.includes('No edit, no commit'));
    assert(execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRootForVision, encoding: 'utf8' }).includes('test: existing swipe reliability notes'));
    const ackAfterDecision = await routeMessageWithAi('ok', {
      healthScore: 80,
      momentum: 'MOVING',
      sections: { risks: [], unresolved: [], approvals: [] },
      summary: { topRisk: 'none' }
    }, { recentMessages: [] }, {
      client,
      root: tempRootForVision,
      commit: true,
      push: false
    });
    assert.strictEqual(ackAfterDecision.command, 'acknowledgement');
    assert(ackAfterDecision.response.includes('No new action started'));
    assert(execFileSync('git', ['log', '--oneline', '-1'], { cwd: tempRootForVision, encoding: 'utf8' }).includes('test: existing swipe reliability notes'));
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
