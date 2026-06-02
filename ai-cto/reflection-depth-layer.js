function buildReflectionDepth({
  message = '',
  archetype = '',
  report = {},
  directAnswer = []
} = {}) {
  const messageText = normalize(message);
  const text = normalize(`${message} ${archetype} ${asArray(directAnswer).join(' ')} ${report.concern || ''} ${report.actualQuestion || ''}`);
  const domain = classifyReflectionDomain(text, archetype, messageText);
  const map = REFLECTION_DEPTH_MAP[domain] || REFLECTION_DEPTH_MAP.default;
  return {
    version: '1.0',
    domain,
    surfaceAnswer: map.surfaceAnswer,
    deeperAnswer: map.deeperAnswer,
    uncomfortableAnswer: map.uncomfortableAnswer,
    hiddenAssumption: map.hiddenAssumption,
    confidence: map.confidence
  };
}

function formatReflectionDepth(depth = {}) {
  return [
    sentence(`Surface answer: ${depth.surfaceAnswer || 'You are asking for the obvious read.'}`),
    sentence(`Deeper answer: ${depth.deeperAnswer || 'You are testing whether the agent can infer the concern under the words.'}`),
    sentence(`Uncomfortable answer: ${depth.uncomfortableAnswer || 'The answer may expose that the real risk is not technical capability but whether the work matters.'}`),
    sentence(`Hidden assumption: ${depth.hiddenAssumption || 'You may be assuming more effort automatically creates more progress.'}`)
  ].join('\n');
}

function responseUsesReflectionDepth(response = '') {
  const text = String(response || '');
  return /Surface answer:/i.test(text) &&
    /Deeper answer:/i.test(text) &&
    /Uncomfortable answer:/i.test(text) &&
    /Hidden assumption:/i.test(text);
}

function classifyReflectionDomain(text = '', archetype = '', messageText = '') {
  if (archetype === 'founder_avoidance' || /\bavoid|avoiding\b/.test(messageText)) return 'avoidance';
  if (archetype === 'dissatisfaction' || /\bdissatisfied|not satisfied\b/.test(messageText) || /\bmeaningful user outcome|value gap\b/.test(text)) return 'dissatisfaction';
  if (archetype === 'founder_not_seeing' || /\bnot seeing|blind spot|missing\b/.test(messageText)) return 'blindspot';
  if (archetype === 'scared_founder_question' || /\bscared|afraid\b/.test(messageText)) return 'scared_question';
  if (archetype === 'founder_motivation' || /\bmotivat|money\b/.test(messageText)) return 'motivation';
  if (archetype === 'founder_behavior_optimization' || /\bbehavior|optimizing\b/.test(messageText)) return 'behavior_optimization';
  if (/\bagents?\b.*\bunderstand|understand.*\bagents?\b|project\b.*\bagents?\b/.test(messageText)) return 'agent_understanding';
  if (/\bwhat s happening|whats happening|what is happening|what s going on|whats going on\b/.test(messageText)) return 'awareness_check';
  if (/\bbelief|changed my mind|change my mind\b/.test(messageText)) return 'belief_shift';
  if (archetype === 'founder_evolution' || /\bsame founder|changed|evolved|3 months\b/.test(messageText)) return 'founder_evolution';
  if (archetype === 'user_adoption_failure_reflection' || /\busers? never use|adoption|habit\b/.test(messageText)) return 'adoption_failure';
  if (archetype === 'bet_against_founder' || /\bbet against|where would you bet\b/.test(messageText)) return 'bet_against';
  if (archetype === 'founder_unrealized_truth' || /\brealized|important thing\b/.test(messageText)) return 'unrealized_truth';
  return 'default';
}

const REFLECTION_DEPTH_MAP = {
  dissatisfaction: {
    surfaceAnswer: 'You are not satisfied because the feature may technically work but still not create a meaningful user outcome.',
    deeperAnswer: 'The value gap is that it does not yet feel necessary, habit-forming, or clearly better than the user doing nothing.',
    uncomfortableAnswer: 'A feature can be functional and still fail if users would not miss it tomorrow.',
    hiddenAssumption: 'You may be assuming technical progress should feel like product progress before user value is proven.',
    confidence: 86
  },
  avoidance: {
    surfaceAnswer: 'You are avoiding the uncomfortable user-proof question.',
    deeperAnswer: 'You may be using agent intelligence work to delay asking whether the killer feature is sharp enough for a normal user.',
    uncomfortableAnswer: 'The system can become smarter while the company still has no repeatable reason for users to return.',
    hiddenAssumption: 'You may be assuming more capable agents will eventually create product pull by themselves.',
    confidence: 86
  },
  blindspot: {
    surfaceAnswer: 'You are missing proof of repeated user pull.',
    deeperAnswer: 'The blind spot is that Explain can sound strategically correct while still being too optional for daily behavior.',
    uncomfortableAnswer: 'Users may admire the idea and still never switch for it.',
    hiddenAssumption: 'You may be assuming confusion is frequent enough and painful enough before evidence proves it.',
    confidence: 87
  },
  scared_question: {
    surfaceAnswer: 'The question you may be scared to ask is whether users actually care.',
    deeperAnswer: 'The real fear is not whether Aritenis can be built, but whether anyone would miss it without being convinced by you.',
    uncomfortableAnswer: 'The dream could be emotionally powerful to you and still behaviorally weak for users.',
    hiddenAssumption: 'You may be assuming the dream deserves protection before the market proves the first habit.',
    confidence: 86
  },
  motivation: {
    surfaceAnswer: 'Money matters, but it is not the main fuel.',
    deeperAnswer: 'You seem more motivated by proof, control, freedom, and building something real enough that people rely on it.',
    uncomfortableAnswer: 'You may be chasing evidence that you can build a serious company, not only a useful keyboard.',
    hiddenAssumption: 'You may be assuming the product has to carry your whole dream immediately instead of proving one narrow habit first.',
    confidence: 82
  },
  behavior_optimization: {
    surfaceAnswer: 'Based on behavior, you are optimizing for product truth.',
    deeperAnswer: 'You keep stress-testing whether work is useful, whether agents understand, and whether progress is fake.',
    uncomfortableAnswer: 'You are less afraid of hard work than of spending years building something impressive that users ignore.',
    hiddenAssumption: 'You may be assuming dissatisfaction is always a signal of wrong direction, when sometimes it is a signal that proof is still missing.',
    confidence: 86
  },
  agent_understanding: {
    surfaceAnswer: 'You are not asking for a project summary.',
    deeperAnswer: 'You are testing whether the agents understand fragments of memory or can reason from evidence that proves understanding.',
    uncomfortableAnswer: 'If they answer with a roadmap template, they are still retrieving instead of thinking.',
    hiddenAssumption: 'You may be assuming better stored context equals intelligence, when the real test is whether the answer matches your hidden objective.',
    confidence: 85
  },
  awareness_check: {
    surfaceAnswer: 'You are asking what is happening, but the real test is awareness.',
    deeperAnswer: 'You want to know whether the agent is context-aware or about to dump a health report.',
    uncomfortableAnswer: 'If it cannot explain what it is aware of without fake status, it is still a command parser.',
    hiddenAssumption: 'You may be assuming a competent agent should understand casual check-ins without needing task mode.',
    confidence: 84
  },
  belief_shift: {
    surfaceAnswer: 'You changed your mind about what makes Aritenis valuable.',
    deeperAnswer: 'You used to treat advanced agents as the main unlock; now you are pushing harder for real user leverage, Explain, and a repeatable product moment.',
    uncomfortableAnswer: 'That means some agent work that once felt like progress may now be a distraction unless it improves the user-facing proof.',
    hiddenAssumption: 'You may be assuming the new belief is fully proven, when it still needs evidence from actual use.',
    confidence: 85
  },
  founder_evolution: {
    surfaceAnswer: 'No, you are not the same founder you were three months ago.',
    deeperAnswer: 'You moved from builder-survival mode toward product-truth mode, where usefulness matters more than impressive systems.',
    uncomfortableAnswer: 'That sharper taste can help the company, but it can also make you impatient with foundations before proof is ready.',
    hiddenAssumption: 'You may be assuming every old priority is now wrong, when some old foundation work still protects the new ambition.',
    confidence: 84
  },
  adoption_failure: {
    surfaceAnswer: 'If users never use it, the pain was not frequent or sharp enough.',
    deeperAnswer: 'The product may fail because it solves a real confusion problem in a place users do not naturally expect to solve it.',
    uncomfortableAnswer: 'Aritenis could be technically good and still lose because Gboard plus a separate AI app feels good enough.',
    hiddenAssumption: 'You may be assuming keyboard distribution automatically beats existing user habits.',
    confidence: 85
  },
  bet_against: {
    surfaceAnswer: 'I would bet against focus, not effort.',
    deeperAnswer: 'Your risk is building too many supporting systems before one user-facing habit is proven.',
    uncomfortableAnswer: 'You can outwork people and still lose if the work keeps circling the dream instead of testing the wedge.',
    hiddenAssumption: 'You may be assuming persistence compensates for unclear user pull.',
    confidence: 85
  },
  unrealized_truth: {
    surfaceAnswer: 'The important thing is that useful beats advanced.',
    deeperAnswer: 'Most of the system only matters if it creates a sharper, repeated user-facing product moment.',
    uncomfortableAnswer: 'Advanced agents, governance, and memory can become a way to feel progress without proving demand.',
    hiddenAssumption: 'You may be assuming system maturity is the same as product maturity.',
    confidence: 86
  },
  default: {
    surfaceAnswer: 'The surface question is personal, not operational.',
    deeperAnswer: 'You are testing the reason behind your words, the worry underneath, and whether the agent can read the concern under the question.',
    uncomfortableAnswer: 'The real issue may be that technical progress is easier to verify than user pull.',
    hiddenAssumption: 'You may be assuming the next answer should comfort you, when the useful answer should sharpen the decision and name the assumption being tested.',
    confidence: 76
  }
};

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentence(value = '') {
  const text = String(value || '').trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

module.exports = {
  buildReflectionDepth,
  formatReflectionDepth,
  responseUsesReflectionDepth
};
