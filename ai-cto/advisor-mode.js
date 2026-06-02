const EXECUTION_LANGUAGE = /\b(implement|execute|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|fix now)\b/i;
const ADVISOR_LANGUAGE = /\b(should|why|what if|what happens|moving toward|dream|vision|wrong thing|dangerous assumption|disagree|missing|users?\s+(care|want|need)|fail|opportunity cost|leverage|strategy|strategic|useful|impressive)\b/i;
const ADVISOR_CATEGORIES = new Set([
  'VISION',
  'DOUBT',
  'FOUNDER_STRATEGY',
  'FOUNDER_QUESTION',
  'STRATEGIC_DISCUSSION'
]);

function shouldUseAdvisorMode({
  message = '',
  category = '',
  intent = ''
} = {}) {
  const text = `${message} ${category} ${intent}`.trim();
  if (!text) return false;
  if (EXECUTION_LANGUAGE.test(message)) return false;
  return ADVISOR_CATEGORIES.has(category) || ADVISOR_LANGUAGE.test(text);
}

function buildAdvisorMode({
  message = '',
  category = '',
  intent = '',
  strategicThinking = {},
  directAnswer = []
} = {}) {
  const text = `${message} ${category} ${intent} ${asArray(directAnswer).join(' ')}`.toLowerCase();
  const domain = classifyAdvisorDomain(text, strategicThinking.domain);
  const profile = ADVISOR_DOMAIN_MAP[domain] || ADVISOR_DOMAIN_MAP.default;

  return {
    mode: 'ADVISOR',
    domain,
    longTermConsequence: profile.longTermConsequence || strategicThinking.secondOrderConsequence || 'Long-term consequence is unknown.',
    opportunityCost: strategicThinking.opportunityCost || profile.opportunityCost || 'Opportunity cost is unknown.',
    leverage: profile.leverage,
    strategicTruth: profile.strategicTruth || strategicThinking.ctoBias || 'The strategic truth is unclear.',
    recommendation: profile.recommendation || strategicThinking.alternativePath || 'Choose the path with the strongest user proof.',
    confidence: Math.min(90, profile.confidence || strategicThinking.confidence || 76)
  };
}

function formatAdvisorMode(advisor = {}) {
  return [
    'Advisor Mode:',
    `- Long-term consequence: ${advisor.longTermConsequence || 'unknown'}`,
    `- Opportunity cost: ${advisor.opportunityCost || 'unknown'}`,
    `- Leverage: ${advisor.leverage || 'unknown'}`,
    `- Strategic truth: ${advisor.strategicTruth || 'unknown'}`,
    `- Recommendation: ${advisor.recommendation || 'unknown'}`
  ].join('\n');
}

function responseUsesAdvisorMode(response = '') {
  const text = String(response || '');
  return /Advisor Mode:/i.test(text) &&
    /Long-term consequence:/i.test(text) &&
    /Opportunity cost:/i.test(text) &&
    /Leverage:/i.test(text) &&
    /Strategic truth:/i.test(text) &&
    /Recommendation:/i.test(text);
}

function classifyAdvisorDomain(text = '', strategicDomain = '') {
  if (/\b(fail|premortem|dangerous assumption|kill this|missing)\b/.test(text)) return 'premortem';
  if (/\b(users?\s+(do not|don't|care|want|need)|user value|useful|optional)\b/.test(text)) return 'user_value';
  if (/\b(dream|vision|chasing|ambition|wrong thing|moving toward|alignment)\b/.test(text)) return 'vision_alignment';
  if (/\b(explain|screenshot|execution layer|glass handle|action surface)\b/.test(text)) return 'phase2_explain';
  if (/\b(disagree|push back|bet against)\b/.test(text)) return 'disagreement';
  return strategicDomain || 'default';
}

const ADVISOR_DOMAIN_MAP = {
  vision_alignment: {
    longTermConsequence: 'If the company keeps improving systems without proving a user-facing wedge, Aritenis can become operationally impressive but strategically weak.',
    leverage: 'Highest leverage is proving one repeated Explain moment users would miss, not adding more agent machinery.',
    strategicTruth: 'The dream only matters commercially if it compresses a painful daily moment for real users.',
    recommendation: 'Protect the keyboard foundation, then spend strategic energy on proving Explain with evidence.',
    confidence: 84
  },
  phase2_explain: {
    longTermConsequence: 'A narrow Explain wedge can turn the keyboard from a typing tool into an action surface without degrading Phase 1 trust.',
    leverage: 'Leverage is high only if Explain is faster than screenshot sharing plus opening a separate AI app.',
    strategicTruth: 'The feature wins by reducing confusion at the exact moment of typing, not by sounding like a chatbot.',
    recommendation: 'Design the smallest Explain loop with confirm/cancel and privacy boundaries before broader companion behavior.',
    confidence: 83
  },
  user_value: {
    longTermConsequence: 'If users do not feel a repeated pain, the product will be admired as an idea and ignored as a habit.',
    leverage: 'The only leverage that matters here is frequency multiplied by pain removed.',
    strategicTruth: 'Aritenis cannot win because it is advanced; it wins only if it is useful at a moment users already have.',
    recommendation: 'Force every Phase 2 idea through user-notice, user-care, user-return, and user-pay judgment.',
    confidence: 82
  },
  premortem: {
    longTermConsequence: 'The company fails if it mistakes infrastructure progress for product pull long enough to miss the habit-forming wedge.',
    leverage: 'The strongest leverage is cutting weak directions early and concentrating on one proof loop.',
    strategicTruth: 'The founder risk is not lack of effort; it is spending effort where users cannot feel it.',
    recommendation: 'Name the riskiest assumption, define what evidence would disprove it, and avoid building around hope.',
    confidence: 84
  },
  disagreement: {
    longTermConsequence: 'A system that only agrees will protect momentum while allowing strategic drift.',
    leverage: 'Useful disagreement has leverage when it changes what gets cut, delayed, or tested first.',
    strategicTruth: 'Founder conviction is valuable, but it must keep submitting to user proof.',
    recommendation: 'Disagree on opportunity cost first: what user proof is being delayed by the current work?',
    confidence: 81
  },
  default: {
    longTermConsequence: 'The long-term risk is spending attention on work that improves the system but not the company.',
    leverage: 'Leverage comes from decisions that increase user pull or reduce strategic uncertainty.',
    strategicTruth: 'A good CTO answer should change the decision, not just complete the conversation.',
    recommendation: 'Answer the founder objective first, then expose the tradeoff that matters most.',
    confidence: 76
  }
};

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

module.exports = {
  shouldUseAdvisorMode,
  buildAdvisorMode,
  formatAdvisorMode,
  responseUsesAdvisorMode
};
