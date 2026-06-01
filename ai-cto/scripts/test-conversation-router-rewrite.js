const assert = require('assert');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-conversation-router-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-conversation-router-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-conversation-router-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-conversation-router-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-conversation-router-governance-state.json');
process.env.ARITENIS_WHATSAPP_MEMORY_FILE = path.join(os.tmpdir(), 'aritenis-conversation-router-whatsapp-memory.json');

const {
  ROUTES,
  classifyConversationRoute,
  isFounderThinkingRoute
} = require('../whatsapp/conversation-router-rewrite');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');

setMode('ACTIVE', 'conversation router rewrite test');

const forbidden = /(TASK_PLAN|APPROVE|Execution Plan|Coder:?\s*Ready|Reviewer:?\s*Ready|CODER:\s*Ready|REVIEWER:\s*Standing by|Health\s*Score|Health:\s*\d+|Momentum|Team is online|team is ready)/i;

const cases = [
  {
    text: 'What am I actually chasing?',
    route: ROUTES.FOUNDER_REFLECTION,
    expected: /personal intelligence layer|phone|keyboard|trust|leverage/i
  },
  {
    text: "What do you think I'm actually chasing?",
    route: ROUTES.FOUNDER_REFLECTION,
    expected: /personal intelligence layer|phone|keyboard|trust|leverage/i
  },
  {
    text: 'Why am I not satisfied?',
    route: ROUTES.FOUNDER_REFLECTION,
    expected: /dissatisfied|meaningful user outcome|value gap|emotional reaction/i
  },
  {
    text: 'Are we moving toward the dream?',
    route: ROUTES.FOUNDER_VISION,
    expected: /Partially|dream|personal intelligence layer|infrastructure|aligned/i
  },
  {
    text: 'If Aritenis succeeds beyond our expectations, what does the world look like?',
    route: ROUTES.FOUNDER_VISION,
    expected: /Partially|dream|personal intelligence layer|infrastructure|aligned|phone-native intelligence layer/i
  },
  {
    text: "I think we're focusing on the wrong thing.",
    route: ROUTES.FOUNDER_DOUBT,
    expected: /infrastructure|killer feature|misalignment|founder objective|strategic discussion/i
  },
  {
    text: 'Something feels off.',
    route: ROUTES.FOUNDER_DOUBT,
    expected: /infrastructure|killer feature|misalignment|founder objective|strategic discussion|product direction|user value|agent behavior/i
  },
  {
    text: 'What happens if we focus only on the execution layer for 6 months?',
    route: ROUTES.FOUNDER_STRATEGY,
    expected: /infrastructure|killer feature|misalignment|founder objective|strategic discussion|execution layer/i
  }
];

for (const item of cases) {
  const classification = classifyConversationRoute(item.text);
  assert.strictEqual(classification.route, item.route, item.text);
  assert(isFounderThinkingRoute(classification), item.text);

  const routed = routeMessage(item.text, {}, {});
  assert.strictEqual(routed.command, 'founder_mind_reconstruction', item.text);
  assert.strictEqual(routed.matchedRoute, 'founder_mind_reconstruction', item.text);
  assert.strictEqual(routed.details.conversationRoute, item.route, item.text);
  assert.strictEqual(routed.details.bypassedExecutionTemplates, true, item.text);
  assert.match(routed.response, item.expected, item.text);
  assert.doesNotMatch(routed.response, forbidden, item.text);
}

(async () => {
  const routed = await routeMessageWithAi('Are we moving toward the dream?', {}, {});
  assert.strictEqual(routed.command, 'founder_mind_reconstruction');
  assert.strictEqual(routed.matchedRoute, 'founder_mind_reconstruction');
  assert.strictEqual(routed.usedAi, false);
  assert.strictEqual(routed.aiReason, 'founder_mind_reconstruction');
  assert.strictEqual(routed.details.conversationRoute, ROUTES.FOUNDER_VISION);
  assert.doesNotMatch(routed.response, forbidden);
  console.log('Conversation router rewrite checks passed');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
