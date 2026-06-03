const assert = require('assert');

const {
  enforceFounderPresence,
  enforceFounderPresenceOnRoute,
  stripFrameworkLabel
} = require('../whatsapp/founder-presence-override');
const { routeMessageWithAi } = require('../whatsapp/command-router');

const noisy = [
  'type: TASK_PLAN',
  'Memory Sources Used: founder_memory, session_memory',
  'Route Confidence: 88%',
  'Strategic Memory Used: belief evolution',
  'Intent: RECONSTRUCT_FOUNDER_VISION',
  'Route Reason: matched reflection route',
  'Dream Drift Alert: possible drift',
  'Internal Diagnostics: route trace',
  '🎯 CTO: Founder, this role label should be hidden.',
  'Surface answer: You are chasing human freedom, not machinery.',
  'Deeper answer: The product only matters if it reduces burden.'
].join('\n');

const cleaned = enforceFounderPresence(noisy);

assert(!/Memory Sources Used|Route Confidence|Strategic Memory Used|Intent:|Route Reason|Dream Drift|Internal Diagnostics|type: TASK_PLAN|CTO:/i.test(cleaned));
assert(cleaned.includes('Founder, this role label should be hidden.'));
assert(cleaned.includes('You are chasing human freedom, not machinery.'));
assert(cleaned.includes('The product only matters if it reduces burden.'));
assert.strictEqual(stripFrameworkLabel('Advisor read: Tell the truth.'), 'Tell the truth.');

const diagnosticTail = enforceFounderPresence([
  'Things are running, but I should not call it fully clean.',
  'Main watch item: unknown.',
  'Dream alignment:',
  '- Current task: internal explanation',
  '- Project goal: internal explanation',
  'Current Founder Mission: hidden',
  'Contrarian read:',
  '- Strongest case for: hidden',
  '- Likely reality: hidden',
  'Objective reconstruction:',
  '- Founder is checking operational reality.',
  'Evidence used:',
  '- Founder memory loaded.',
  'A smarter critic would ask whether this creates user-visible value.'
].join('\n'));
assert(diagnosticTail.includes('Things are running'));
assert(diagnosticTail.includes('Main watch item'));
assert(!/Dream alignment|Current Founder Mission|Contrarian read|Objective reconstruction|Evidence used|A smarter critic/i.test(diagnosticTail));

const route = enforceFounderPresenceOnRoute({
  command: 'founder_mind_reconstruction',
  response: noisy,
  details: {}
});
assert.strictEqual(route.details.founderPresenceOverride, true);
assert(!/Memory Sources Used|Route Confidence|Intent:/i.test(route.response));

(async () => {
  const routed = await routeMessageWithAi('Bro what do you think I am actually chasing?', {}, {}, {
    commit: false,
    push: false,
    deferLowRiskVisionExecution: true
  });
  assert(!/Memory Sources Used|Route Confidence|Strategic Memory Used|Intent:|Route Reason|Dream Drift|Internal Diagnostics|Objective:|Assumption:|Concern:/i.test(routed.response));
  assert(!/founderPresenceOverride/i.test(routed.response));
  console.log('Founder presence override checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
