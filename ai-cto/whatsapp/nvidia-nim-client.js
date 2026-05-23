const { logAgentAction } = require('./agent-action-log');

const ENDPOINT = 'https://integrate.api.nvidia.com/v1';
const MODEL_ASSIGNMENT = {
  deepseek: {
    label: 'DeepSeek V4 Flash',
    model: 'deepseek/deepseek-v4-flash',
    envKey: 'NVIDIA_DEEPSEEK_API_KEY',
    role: 'Code Brain'
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
  const llamaKey = options.llamaKey || process.env.NVIDIA_LLAMA_API_KEY || '';
  const transport = options.transport || defaultTransport;
  const endpoint = options.endpoint || ENDPOINT;

  function available(kind) {
    if (kind === 'deepseek') return Boolean(deepseekKey);
    if (kind === 'llama') return Boolean(llamaKey);
    return false;
  }

  async function chat(kind, messages, chatOptions = {}) {
    const assignment = MODEL_ASSIGNMENT[kind];
    if (!assignment) throw new Error(`Unknown NVIDIA model kind: ${kind}`);
    const apiKey = kind === 'deepseek' ? deepseekKey : llamaKey;
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
      const response = await transport({
        endpoint,
        apiKey,
        model: assignment.model,
        messages,
        temperature: chatOptions.temperature == null ? 0.2 : chatOptions.temperature,
        maxTokens: chatOptions.maxTokens || 900
      });
      const content = extractContent(response);
      const usage = response && response.usage ? response.usage : { total_tokens: 0 };
      logAgentAction({
        agentName: kind === 'deepseek' ? 'Coder' : 'CTO',
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
        agentName: kind === 'deepseek' ? 'Coder' : 'CTO',
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

async function defaultTransport({ endpoint, apiKey, model, messages, temperature, maxTokens }) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
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
  createNvidiaClient,
  parseRiskLevel
};
