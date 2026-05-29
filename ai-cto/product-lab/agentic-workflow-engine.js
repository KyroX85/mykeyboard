const ACTION_IDS = Object.freeze({
  COPY: 'copy',
  EDIT: 'edit',
  SEND: 'send',
  SAVE_TEMPLATE: 'save_template',
  CONVERT_WHATSAPP: 'convert_whatsapp',
  CONVERT_EMAIL: 'convert_email'
});

const INTENT_CATEGORIES = Object.freeze({
  MESSAGE: 'message',
  EMAIL_DRAFT: 'email_draft',
  WHATSAPP_REPLY: 'whatsapp_reply',
  SEARCH_QUERY: 'search_query',
  TASK_PLANNING: 'task_planning',
  GENERAL_TEXT: 'general_text'
});

function generateAgenticWorkflow({
  text = '',
  enabled = true,
  style = 'friendly',
  supportedIntegrations = {},
  surface = 'keyboard_overlay'
} = {}) {
  const cleanText = normalizeText(text);
  if (!enabled || cleanText.length < 3) {
    return disabledWorkflow(cleanText, surface);
  }

  const intent = detectIntentCategory(cleanText);
  const output = generateIntelligentOutput({ text: cleanText, intent, style });
  const actions = buildActionOptions({ intent, supportedIntegrations });
  const suggestions = buildAgentSuggestions({ intent, style, text: cleanText });

  return {
    enabled: true,
    surface,
    intent,
    output,
    actions,
    suggestions,
    overlay: {
      type: 'optional_action_sheet',
      nonBlocking: true,
      blocksTyping: false,
      trigger: 'explicit_user_tap_or_idle_suggestion',
      priority: intent.category === INTENT_CATEGORIES.GENERAL_TEXT ? 'low' : 'normal'
    },
    privacy: privacyContract()
  };
}

function enhancePredictionPipeline({
  currentText = '',
  predictionCandidates = [],
  enabled = false,
  style = 'friendly',
  supportedIntegrations = {}
} = {}) {
  const safeCandidates = Array.isArray(predictionCandidates)
    ? predictionCandidates.slice(0, 8)
    : [];
  return {
    nonBlocking: true,
    predictionCandidates: safeCandidates,
    agenticOverlay: generateAgenticWorkflow({
      text: currentText,
      enabled,
      style,
      supportedIntegrations,
      surface: 'prediction_optional_enhancer'
    })
  };
}

function detectIntentCategory(text = '') {
  const cleanText = normalizeText(text);
  const lower = cleanText.toLowerCase();

  if (/\b(whatsapp|wa reply|reply|bro|da|machan|anna|send him|send her)\b/.test(lower)) {
    return decision(INTENT_CATEGORIES.WHATSAPP_REPLY, 0.86, 'reply or WhatsApp-style language detected');
  }
  if (/\b(email|mail|subject|dear|regards|sir|madam)\b/.test(lower)) {
    return decision(INTENT_CATEGORIES.EMAIL_DRAFT, 0.88, 'email vocabulary detected');
  }
  if (/^(search|google|find|look up)\b/.test(lower) || /\b(best|near me|how to|what is|where to buy)\b/.test(lower)) {
    return decision(INTENT_CATEGORIES.SEARCH_QUERY, 0.74, 'search wording detected');
  }
  if (/\b(plan|todo|task|steps|finish|schedule|remind|tomorrow|deadline|build|push)\b/.test(lower)) {
    return decision(INTENT_CATEGORIES.TASK_PLANNING, 0.8, 'planning or task wording detected');
  }
  if (/[.!?]$/.test(cleanText) || cleanText.split(/\s+/).length >= 4) {
    return decision(INTENT_CATEGORIES.MESSAGE, 0.68, 'message-like text detected');
  }
  return decision(INTENT_CATEGORIES.GENERAL_TEXT, 0.5, 'general text fallback');
}

function generateIntelligentOutput({ text = '', intent = detectIntentCategory(text), style = 'friendly' } = {}) {
  const cleanText = normalizeText(text);
  const normalizedStyle = normalizeStyle(style);
  const refined = refineDraft(cleanText, intent.category, normalizedStyle);

  return {
    style: normalizedStyle,
    refinedDraft: refined,
    improvementSummary: summarizeImprovement(cleanText, refined),
    confidence: intent.confidence
  };
}

function buildActionOptions({ intent, supportedIntegrations = {} } = {}) {
  const category = intent?.category || INTENT_CATEGORIES.GENERAL_TEXT;
  const actions = [
    action(ACTION_IDS.COPY, 'Copy', 'Copy refined output'),
    action(ACTION_IDS.EDIT, 'Edit', 'Open editable draft'),
    action(ACTION_IDS.SAVE_TEMPLATE, 'Save template', 'Save local reusable text')
  ];

  if (category === INTENT_CATEGORIES.WHATSAPP_REPLY || category === INTENT_CATEGORIES.MESSAGE) {
    actions.push(action(ACTION_IDS.CONVERT_WHATSAPP, 'WhatsApp format', 'Convert to concise chat message'));
  }
  if (category === INTENT_CATEGORIES.EMAIL_DRAFT) {
    actions.push(action(ACTION_IDS.CONVERT_EMAIL, 'Email format', 'Convert to subject and body'));
  }
  if (supportedIntegrations.whatsapp || supportedIntegrations.email || supportedIntegrations.shareSheet) {
    actions.push(action(ACTION_IDS.SEND, 'Send', 'Send through supported integration'));
  }

  return actions;
}

function buildAgentSuggestions({ intent, style, text }) {
  const category = intent?.category || INTENT_CATEGORIES.GENERAL_TEXT;
  const suggestions = [
    suggestion('improve_tone', 'Want me to improve tone?'),
    suggestion('shorten', 'Make it shorter?')
  ];

  if (category !== INTENT_CATEGORIES.EMAIL_DRAFT) {
    suggestions.push(suggestion('formal_email', 'Turn into formal email?'));
  }
  if (category === INTENT_CATEGORIES.TASK_PLANNING || /\b(plan|task|todo)\b/i.test(text)) {
    suggestions.push(suggestion('steps', 'Turn into clear steps?'));
  }
  if (style !== 'casual') {
    suggestions.push(suggestion('casual', 'Make it more casual?'));
  }

  return suggestions.slice(0, 4);
}

function refineDraft(text, category, style) {
  if (!text) return '';
  if (category === INTENT_CATEGORIES.EMAIL_DRAFT) return toEmailDraft(text, style);
  if (category === INTENT_CATEGORIES.TASK_PLANNING) return toTaskPlan(text);
  if (category === INTENT_CATEGORIES.SEARCH_QUERY) return toSearchQuery(text);
  if (category === INTENT_CATEGORIES.WHATSAPP_REPLY) return toWhatsAppDraft(text, style);
  return sentenceCase(preserveKnownAcronyms(text));
}

function toEmailDraft(text, style) {
  const body = sentenceCase(stripLeadingCommand(text, /^(email|mail)\s+/i));
  const greeting = style === 'formal' ? 'Dear team,' : 'Hi team,';
  const closing = style === 'formal' ? 'Regards,' : 'Thanks,';
  return `Subject: ${summarizeSubject(body)}\n\n${greeting}\n\n${body}\n\n${closing}`;
}

function toTaskPlan(text) {
  const clean = stripLeadingCommand(text, /^plan\s+/i);
  const parts = clean
    .split(/\b(?:and|then|,)\b/i)
    .map((part) => sentenceCase(part.trim()))
    .filter(Boolean);
  const steps = parts.length >= 2 ? parts : sentenceCase(clean).split(/\s+(?=build|test|push|verify|finish)\b/i);
  return steps
    .map((step, index) => `${index + 1}. ${sentenceCase(step.trim())}`)
    .join('\n');
}

function toSearchQuery(text) {
  return stripLeadingCommand(text, /^(search|google|find|look up)\s+/i)
    .replace(/[?.!]+$/g, '')
    .trim()
    .toLowerCase();
}

function toWhatsAppDraft(text, style) {
  const clean = sentenceCase(preserveKnownAcronyms(text));
  if (style === 'formal') return clean;
  return clean
    .replace(/\bplease\b/gi, 'pls')
    .replace(/\bI will\b/g, "I'll");
}

function summarizeSubject(text) {
  const words = text.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  return sentenceCase(words.slice(0, 7).join(' ') || 'Update');
}

function summarizeImprovement(original, refined) {
  if (original === refined) return 'No rewrite needed; action options prepared.';
  return 'Draft refined locally with intent-aware formatting.';
}

function preserveKnownAcronyms(text) {
  return text
    .replace(/\bapk\b/gi, 'APK')
    .replace(/\bai\b/gi, 'AI')
    .replace(/\bui\b/gi, 'UI')
    .replace(/\bux\b/gi, 'UX')
    .replace(/\bwhatsapp\b/gi, 'WhatsApp');
}

function sentenceCase(text) {
  const clean = normalizeText(text);
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function stripLeadingCommand(text, pattern) {
  return normalizeText(text).replace(pattern, '').trim();
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeStyle(style) {
  return ['casual', 'formal', 'friendly'].includes(style) ? style : 'friendly';
}

function disabledWorkflow(text, surface) {
  return {
    enabled: false,
    surface,
    intent: decision(INTENT_CATEGORIES.GENERAL_TEXT, 0, 'agentic workflow disabled'),
    output: {
      style: 'friendly',
      refinedDraft: text,
      improvementSummary: 'Disabled',
      confidence: 0
    },
    actions: [],
    suggestions: [],
    overlay: {
      type: 'none',
      nonBlocking: true,
      blocksTyping: false,
      trigger: 'disabled',
      priority: 'off'
    },
    privacy: privacyContract()
  };
}

function privacyContract() {
  return {
    offlineFirst: true,
    networkRequired: false,
    rawExternalLoggingAllowed: false,
    storesRawTextByDefault: false
  };
}

function decision(category, confidence, reason) {
  return { category, confidence, reason };
}

function action(id, label, description) {
  return { id, label, description, requiresUserTap: true };
}

function suggestion(id, label) {
  return { id, label, optional: true };
}

module.exports = {
  ACTION_IDS,
  INTENT_CATEGORIES,
  buildActionOptions,
  buildAgentSuggestions,
  detectIntentCategory,
  enhancePredictionPipeline,
  generateAgenticWorkflow,
  generateIntelligentOutput
};
