const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  MODEL_ASSIGNMENT,
  createNvidiaClient,
  parseRiskLevel,
  STRICT_GUARDRAIL_PROMPT
} = require('../whatsapp/nvidia-nim-client');
const {
  buildAiWhatsAppPrompt,
  maybeGenerateAiWhatsAppResponse
} = require('../whatsapp/ai-whatsapp-responder');
const {
  executeAiBridge,
  buildDeepSeekFixPrompt,
  buildLlamaRiskPrompt,
  diffWithinHardLimits
} = require('./ai-execution-bridge');
const { routeMessageWithAi } = require('../whatsapp/command-router');
const { ACTION_LOG_FILE } = require('../whatsapp/agent-action-log');
const { AGENT_BRAIN_DIR } = require('../whatsapp/main-agent-brain-manager');
const {
  VISION_COMMAND_LOG_FILE,
  readVisionCommandState
} = require('../whatsapp/vision-command-manager');

async function run() {
  const actionLogBackup = fs.existsSync(ACTION_LOG_FILE) ? fs.readFileSync(ACTION_LOG_FILE, 'utf8') : null;
  const visionLogBackup = fs.existsSync(VISION_COMMAND_LOG_FILE) ? fs.readFileSync(VISION_COMMAND_LOG_FILE, 'utf8') : null;
  const brainBackup = fs.existsSync(AGENT_BRAIN_DIR)
    ? new Map(fs.readdirSync(AGENT_BRAIN_DIR).map((file) => [file, fs.readFileSync(path.join(AGENT_BRAIN_DIR, file), 'utf8')]))
    : new Map();
  try {
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
  assert(calls[0].messages[0].content.startsWith(STRICT_GUARDRAIL_PROMPT));
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
  assert(prompt.system.includes('English only'));
  assert(prompt.system.includes('startup CTO reporting to their CEO'));
  assert(prompt.system.includes('Address the founder as Founder'));
  assert(prompt.system.includes('Do not use Tamil words'));
  assert(!/Tamil mixed|Tamil naturally/i.test(prompt.system));
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
  assert(aiReply.response.includes('Health is at 80'));

  const routedAi = await routeMessageWithAi('hi', {
    healthScore: 80,
    momentum: 'MOVING',
    sections: { risks: [], unresolved: [], approvals: [] },
    summary: { topRisk: 'none' }
  }, { recentMessages: [] }, { client });
  assert.strictEqual(routedAi.usedAi, true);
  assert(routedAi.response.includes('What would you like to prioritize'));

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
  }
}

run().then(() => {
  console.log('NVIDIA AI bridge checks passed.');
});
