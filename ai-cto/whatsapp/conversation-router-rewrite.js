const ROUTES = Object.freeze({
  FOUNDER_REFLECTION: 'FOUNDER_REFLECTION',
  FOUNDER_DOUBT: 'FOUNDER_DOUBT',
  FOUNDER_VISION: 'FOUNDER_VISION',
  FOUNDER_STRATEGY: 'FOUNDER_STRATEGY',
  FOUNDER_EXECUTION: 'FOUNDER_EXECUTION',
  PROJECT_STATUS: 'PROJECT_STATUS',
  EXECUTION_REQUEST: 'EXECUTION_REQUEST'
});

const REFLECTION_PATTERNS = [
  /\bwhat\s+(am\s+i|i\s+am)\s+(actually\s+)?(chasing|trying\s+to\s+build|trying\s+to\s+achieve|after)\b/i,
  /\bwhat\s+do\s+you\s+think\s+i'?m\s+(actually\s+)?(chasing|trying\s+to\s+build|trying\s+to\s+achieve|after)\b/i,
  /\bbased\s+on\s+my\s+behavior\b.*\bwhat\s+(am\s+i|i\s+am)\s+optimizing\s+for\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+optimizing\s+for\b/i,
  /\bforget\s+what\s+i\s+say\b.*\bbased\s+on\s+my\s+behavior\b/i,
  /\bwhat\s+belief\s+have\s+i\s+changed\s+my\s+mind\s+about\b/i,
  /\bwhat\s+have\s+i\s+changed\s+my\s+mind\s+about\b/i,
  /\bchanged\s+my\s+mind\b.*\b(recently|lately|now)\b/i,
  /\b(am|was)\s+i\s+the\s+same\s+founder\b/i,
  /\b(founder|i)\b.*\b(same|changed|evolved|different)\b.*\b(months?|weeks?|ago|before|now)\b/i,
  /\bwhy\s+(am\s+i|i\s+am)\s+not\s+satisfied\b/i,
  /\bwhy\s+(am\s+i|did\s+i)\s+(asking|ask)\b/i,
  /\bwhat\s+(am\s+i|i\s+am)\s+(worried|testing)\b/i
];

const DOUBT_PATTERNS = [
  /\b(i\s+think|i\s+feel|something|this|it)\b.*\b(wrong thing|wrong direction|misaligned|off|not right)\b/i,
  /\b(i'?m|i\s+am)\s+(scared|afraid|worried)\b.*\b(impressive|cool|advanced|complex)\b.*\b(useful|valuable|needed|real)\b/i,
  /\b(impressive|cool|advanced|complex)\s+instead\s+of\s+(useful|valuable|needed|real)\b/i,
  /\b(i\s+don'?t\s+think|i\s+do\s+not\s+think)\s+users?\s+(actually\s+)?(care|want|need)\b/i,
  /\busers?\s+(don'?t|do\s+not)\s+(actually\s+)?(care|want|need)\b/i,
  /\b(who|why)\s+would\s+users?\s+(care|want|need)\b/i,
  /\b(focusing|focused|focus)\s+on\s+the\s+wrong\s+thing\b/i,
  /\bnot\s+satisfied\b/i
];

const VISION_PATTERNS = [
  /\bwhat\s+if\s+my\s+dream\s+(itself\s+)?is\s+wrong\b/i,
  /\bwhat\s+if\s+(the\s+)?dream\s+(itself\s+)?is\s+wrong\b/i,
  /\b(is|could)\s+my\s+dream\s+(be\s+)?wrong\b/i,
  /\b(are|r)\s+we\s+(even\s+)?(moving|going|heading)\s+(toward|towards|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(is|are)\s+(this|we)\s+aligned\s+(with|to)\s+(the\s+)?(dream|vision|goal)\b/i,
  /\b(founder\s+dream|company\s+dream|actual\s+dream)\b/i,
  /\bif\s+aritenis\s+succeeds\b/i,
  /\b(succeeds?|success|win|wins)\s+(beyond\s+our\s+expectations|beyond\s+expectations)\b/i,
  /\bwhat\s+does\s+(the\s+)?world\s+look\s+like\b/i,
  /\bwhat\s+(does|would)\s+success\s+look\s+like\b/i,
  /\bwhat\s+happens\s+if\s+we\s+win\b/i
];

const STRATEGY_PATTERNS = [
  /\bwhat\s+(am\s+i|i\s+am)\s+missing\b/i,
  /\bwhat'?s\s+the\s+most\s+dangerous\s+assumption\b/i,
  /\bwhat\s+is\s+the\s+most\s+dangerous\s+assumption\b/i,
  /\bif\s+we\s+fail\b.*\b(why|how|what)\b/i,
  /\bwhy\s+(would|do)\s+we\s+fail\b/i,
  /\b(what|why)\s+.*\bfail\s+in\s+\d+\s+(years?|months?)\b/i,
  /\b(if\s+you\s+had\s+to\s+)?disagree\s+with\s+me\b/i,
  /\bwhat\s+would\s+you\s+disagree\s+with\b/i,
  /\bwhere\s+(would|do)\s+you\s+(disagree|push\s+back)\b/i,
  /\bwhat\s+happens\s+if\s+we\s+focus\s+only\b/i,
  /\bif\s+we\s+focus\s+only\b/i,
  /\b(what|which)\s+(is|are)\s+(the\s+)?(highest|best|right|next)\s+(leverage|priority|strategy|move)\b/i,
  /\b(should|would)\s+we\s+(focus|prioritize|avoid|stop)\b/i,
  /\bwhat\s+should\s+we\s+not\s+build\b/i
];

const PROJECT_STATUS_PATTERNS = [
  /^status$/i,
  /^health$/i,
  /^momentum$/i,
  /\bwhat'?s\s+going\s+on\b/i,
  /\bhow'?s\s+(it|everything|work|progress)\s+going\b/i
];

const EXECUTION_PATTERNS = [
  /\b(implement|execute|commit|push|modify|edit|write|delete|create file|apply patch|build now|run product lab|fix now)\b/i,
  /^fix$/i,
  /^approve-[a-z0-9_-]+$/i
];

function classifyConversationRoute(message = '') {
  const text = String(message || '').trim();
  const normalized = normalize(text);
  if (!normalized) {
    return route(ROUTES.PROJECT_STATUS, 45, 'empty message falls to safe status/conversation handling');
  }

  if (EXECUTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return route(ROUTES.EXECUTION_REQUEST, 92, 'explicit execution verb or approval token');
  }
  if (REFLECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return route(ROUTES.FOUNDER_REFLECTION, 90, 'founder is asking about hidden motive, satisfaction, or self-questioning');
  }
  if (DOUBT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return route(ROUTES.FOUNDER_DOUBT, 88, 'founder is expressing concern or strategic unease');
  }
  if (VISION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return route(ROUTES.FOUNDER_VISION, 89, 'founder is asking whether work aligns with the dream or vision');
  }
  if (STRATEGY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return route(ROUTES.FOUNDER_STRATEGY, 78, 'founder is asking for strategic judgment, not execution');
  }
  if (PROJECT_STATUS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return route(ROUTES.PROJECT_STATUS, 82, 'founder is asking for status or progress');
  }
  return route(ROUTES.PROJECT_STATUS, 52, 'no high-confidence founder-thinking or execution route');
}

function isFounderThinkingRoute(classification = {}) {
  return [
    ROUTES.FOUNDER_REFLECTION,
    ROUTES.FOUNDER_DOUBT,
    ROUTES.FOUNDER_VISION,
    ROUTES.FOUNDER_STRATEGY
  ].includes(classification.route);
}

function route(name, confidence, reason) {
  return {
    route: name,
    confidence,
    reason
  };
}

function normalize(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

module.exports = {
  ROUTES,
  classifyConversationRoute,
  isFounderThinkingRoute
};
