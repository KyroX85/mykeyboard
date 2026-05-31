const assert = require('assert');

const {
  buildMemorySources,
  enforceMemoryPolicyOnResponse,
  hasMemorySourceDeclaration
} = require('../memory-policy-enforcer');
const { routeMessage, routeMessageWithAi } = require('../whatsapp/command-router');

(async () => {
  const sources = buildMemorySources({
    message: 'what phase are we in?',
    memory: { recentMessages: [{ role: 'founder', summary: 'asked phase' }] },
    founderMemoryLayer: { confidence: 89 }
  });
  assert(sources.includes('current message'));
  assert(sources.includes('short-term context'));
  assert(sources.includes('session memory'));
  assert(sources.includes('persistent founder memory'));

  const plain = enforceMemoryPolicyOnResponse('CTO: answer', { message: 'hi' });
  assert(hasMemorySourceDeclaration(plain));
  assert(plain.startsWith('Memory Sources Used: current message'));

  const repaired = enforceMemoryPolicyOnResponse('I remember everything from the full chat.', { message: 'memory?' });
  assert(!/remember everything|full chat/i.test(repaired));
  assert(repaired.includes('based only on loaded memory sources'));

  const audit = routeMessage('memory audit', {}, {});
  assert(audit.response.startsWith('Memory Sources Used:'));
  assert(audit.response.includes('persistent founder memory'));
  assert(audit.response.includes('Reality reconstruction'));
  assert(!audit.response.includes('I remember everything'));

  const greeting = routeMessage('hi', {}, {});
  assert(greeting.response.startsWith('Memory Sources Used:'));
  assert(greeting.response.includes('CTO: Founder'));

  const aiRoute = await routeMessageWithAi('what is the final goal of our company?', {}, {}, {});
  assert(aiRoute.response.startsWith('Memory Sources Used:'));
  assert(aiRoute.response.includes('persistent founder memory'));
  assert(aiRoute.response.includes('Confidence:'));

  console.log('Memory policy enforcer checks passed');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
