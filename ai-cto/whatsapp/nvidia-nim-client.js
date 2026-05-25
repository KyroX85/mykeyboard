const { logAgentAction } = require('./agent-action-log');

const STRICT_GUARDRAIL_PROMPT = `You are working on Aritenis AI — an Android keyboard with emotional AI for Indian teenagers.
Your ONLY job is to fix or implement exactly what the founder describes.
Do NOT suggest new features outside the task.
Do NOT refactor working code unnecessarily.
Do NOT change anything outside the specific task.
Do NOT touch these files ever:
- google-services.json
- any file in /privacy/ folder
- DatabaseHelper.kt
- any file with 'secret' or 'key' in name
Stability over improvement. Always.
If the task requires touching more than 3 files stop immediately and alert the founder.
For WhatsApp responses, use professional warm English only. Never use Tamil words, slang, da, pa, anna, machi, paathu, or vanakkam.`;

const ENDPOINT = 'https://integrate.api.nvidia.com/v1';
const MODEL_ASSIGNMENT = {
  deepseek: {
    label: 'DeepSeek V4 Flash',
    model: 'deepseek-ai/deepseek-v4-flash',
    envKey: 'NVIDIA_DEEPSEEK_API_KEY',
    role: 'Code Brain'
  },
  qwenCoder: {
    label: 'Qwen3 Coder',
    model: 'qwen/qwen3-coder-480b-a35b-instruct',
    envKey: 'NVIDIA_QWEN_CODER_API_KEY',
    role: 'Fallback Code Brain'
  },
  llama: {
    label: 'Llama 3.3 70B',
    model: 'meta/llama-3.3-70b-instruct',
    envKey: 'NVIDIA_LLAMA_API_KEY',
    role: 'Conversation Brain'
  }
};

function createNvidiaClient(options = {}) {
  const deepseekKey = options.deepseekKey || process.env.NVIDIA_DEEPSEEK_API_KEY || '';
  const qwenCoderKey = options.qwenCoderKey || process.env.NVIDIA_QWEN_CODER_API_KEY || '';
  const llamaKey = options.llamaKey || process.env.NVIDIA_LLAMA_API_KEY || '';
  const transport = options.transport || defaultTransport;
  const endpoint = options.endpoint || ENDPOINT;

  function available(kind) {
    if (kind === 'deepseek') return Boolean(deepseekKey);
    if (kind === 'qwenCoder') return Boolean(qwenCoderKey);
    if (kind === 'llama') return Boolean(llamaKey);
    return false;
  }

  async function chat(kind, messages, chatOptions = {}) {
    const assignment = MODEL_ASSIGNMENT[kind];
    if (!assignment) throw new Error(`Unknown NVIDIA model kind: ${kind}`);
    const apiKey = kind === 'deepseek' ? deepseekKey : kind === 'qwenCoder' ? qwenCoderKey : llamaKey;
    if (!apiKey) {
      return {
        ok: false,
        skipped: true,
        model: assignment.model,
        content: '',
        usage: { total_tokens: 0 },
        reason: `${assignment.envKey} is not configured.`
      };
    }

    const startedAt = Date.now();
    try {
      const guardedMessages = withGuardrailSystemPrompt(messages);
      const response = await transport({
        endpoint,
        apiKey,
        model: assignment.model,
        messages: guardedMessages,
        temperature: chatOptions.temperature == null ? 0.2 : chatOptions.temperature,
        maxTokens: chatOptions.maxTokens || 900
      });
      const content = extractContent(response);
      const usage = response && response.usage ? response.usage : { total_tokens: 0 };
      logAgentAction({
        agentName: kind === 'deepseek' || kind === 'qwenCoder' ? 'Coder' : 'CTO',
        actionTaken: `NVIDIA NIM call: ${assignment.label}`,
        reason: chatOptions.reason || assignment.role,
        riskLevel: chatOptions.riskLevel || 'LOW',
        outcome: `OK model=${assignment.model} tokens=${usage.total_tokens || 0} durationMs=${Date.now() - startedAt}`,
        modelUsed: assignment.model,
        tokensConsumed: usage.total_tokens || 0
      });
      return { ok: true, model: assignment.model, content, usage, raw: response };
    } catch (error) {
      logAgentAction({
        agentName: kind === 'deepseek' || kind === 'qwenCoder' ? 'Coder' : 'CTO',
        actionTaken: `NVIDIA NIM call failed: ${assignment.label}`,
        reason: chatOptions.reason || assignment.role,
        riskLevel: chatOptions.riskLevel || 'MEDIUM',
        outcome: `FAILED ${error.message}`,
        modelUsed: assignment.model,
        tokensConsumed: 0
      });
      return {
        ok: false,
        model: assignment.model,
        content: '',
        usage: { total_tokens: 0 },
        error: error.message
      };
    }
  }

  return { available, chat };
}

function withGuardrailSystemPrompt(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const first = list[0];
  if (first && first.role === 'system') {
    const content = String(first.content || '');
    return [
      {
        ...first,
        content: content.startsWith(STRICT_GUARDRAIL_PROMPT)
          ? content
          : `${STRICT_GUARDRAIL_PROMPT}\n\n${content}`
      },
      ...list.slice(1)
    ];
  }
  return [
    { role: 'system', content: STRICT_GUARDRAIL_PROMPT },
    ...list
  ];
}

async function defaultTransport({ endpoint, apiKey, model, messages, temperature, maxTokens }) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`NVIDIA NIM ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

function extractContent(response) {
  return String(
    response &&
    response.choices &&
    response.choices[0] &&
    response.choices[0].message &&
    response.choices[0].message.content ||
    ''
  ).trim();
}

function parseRiskLevel(text) {
  const normalized = String(text || '').toUpperCase();
  if (/\bHIGH\b/.test(normalized)) return 'HIGH';
  if (/\bMEDIUM\b/.test(normalized)) return 'MEDIUM';
  if (/\bLOW\b/.test(normalized)) return 'LOW';
  return 'MEDIUM';
}

module.exports = {
  ENDPOINT,
  MODEL_ASSIGNMENT,
  STRICT_GUARDRAIL_PROMPT,
  createNvidiaClient,
  withGuardrailSystemPrompt,
  defaultTransport,
  parseRiskLevel
};
