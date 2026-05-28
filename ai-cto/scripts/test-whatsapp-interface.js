const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.ARITENIS_ACTION_LOG_FILE = path.join(os.tmpdir(), 'aritenis-whatsapp-action-log.json');
process.env.ARITENIS_AGENT_BRAIN_DIR = path.join(os.tmpdir(), 'aritenis-whatsapp-agent-brains');
process.env.ARITENIS_VISION_COMMAND_LOG_FILE = path.join(os.tmpdir(), 'aritenis-whatsapp-vision-log.json');
process.env.ARITENIS_SPAWN_FILE = path.join(os.tmpdir(), 'aritenis-whatsapp-spawned-agents.json');
process.env.ARITENIS_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), 'aritenis-whatsapp-governance-state.json');

const { resolveCommand, routeMessage, shouldUseGeneralFallback } = require('../whatsapp/command-router');
const { setMode } = require('../../governance/governance');
const { parseNaturalIntent, isStandaloneGreeting } = require('../whatsapp/natural-intent-parser');
const { twiml, normalizePhone, extractTwilioBody } = require('../whatsapp-server');
const {
  AGENT_BRAIN_DIR,
  SPAWN_FILE,
  parseSpawnRequest,
  readSpawnState
} = require('../whatsapp/specialist-agent-manager');
const {
  CORE_AGENTS,
  ensureCoreAgentBrains,
  readCoreAgentBrain
} = require('../whatsapp/main-agent-brain-manager');

const sampleState = {
  generatedAt: '2026-05-20T05:54:15.010Z',
  healthScore: 25,
  momentum: 'STALLED',
  validation: [
    { task: ':app:testDebugUnitTest', status: 'passed' },
    { task: ':app:assembleDebug', status: 'passed' },
    { task: ':app:lintDebug', status: 'passed' }
  ],
  sections: {
    risks: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    unresolved: ['[HIGH] ARCHITECTURE: Unsafe Try Block in chaos_test.js'],
    repeatedFailures: ['No recurring failure pattern detected yet.'],
    unstableFiles: ['chaos_test.js: 2 appearances in 30-day trend'],
    completedFixes: ['Report and state generation completed for this run.'],
    approvals: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    nextPriority: ['Audit and remove Hardcoded Secret in BasicPredictor.kt.'],
    safestOpportunity: ['Plan a small review-only refactor for KeyboardService.kt.']
  },
  changed: {
    completed: ['Report and state generation completed for this run.'],
    newRisks: ['[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js'],
    lastTrendAt: '2026-05-20T05:54:15.010Z',
    issueCount: 5
  },
  summary: {
    health: '25/100',
    momentum: 'STALLED',
    topRisk: '[CRITICAL] SECURITY: Hardcoded Secret in chaos_test.js',
    nextPriority: 'Audit and remove Hardcoded Secret in BasicPredictor.kt.',
    lastAnalysis: '2026-05-20T05:54:15.010Z'
  }
};

const initialBrainBackup = fs.existsSync(AGENT_BRAIN_DIR)
  ? new Map(fs.readdirSync(AGENT_BRAIN_DIR).map((file) => [file, fs.readFileSync(path.join(AGENT_BRAIN_DIR, file), 'utf8')]))
  : new Map();

assert.strictEqual(resolveCommand('status'), 'status');
assert.strictEqual(resolveCommand('what are the risks?'), 'risks');
assert.strictEqual(resolveCommand('latest risks'), 'risks');
assert.strictEqual(resolveCommand('latest fixes'), 'latest_fixes');
assert.strictEqual(resolveCommand('weekly summary'), 'weekly_summary');
assert.strictEqual(resolveCommand('what changed'), 'what_changed');
assert.strictEqual(resolveCommand('keyboard health'), 'keyboard_health');
assert.strictEqual(resolveCommand('build now'), 'build_now');
assert.strictEqual(resolveCommand('fix limit'), 'fix_limit');
assert.strictEqual(resolveCommand('execution status'), 'execution_status');
assert.deepStrictEqual(resolveCommand('focus predictor'), { command: 'focus', focusTopic: 'predictor' });
assert.strictEqual(resolveCommand('unknown command'), 'unknown');
assert.deepStrictEqual(parseNaturalIntent('hey coder what are you doing').agent, 'coder');
assert.deepStrictEqual(parseNaturalIntent('hey auditor').agent, 'auditor');
assert.deepStrictEqual(parseNaturalIntent('hey auditer').agent, 'auditor');
assert.deepStrictEqual(parseNaturalIntent('audit status').agent, 'auditor');
assert.deepStrictEqual(parseNaturalIntent('reviewer any risks').agent, 'reviewer');
assert.deepStrictEqual(parseNaturalIntent('auditor any dangerous issues').intent, 'risks');
assert.strictEqual(parseNaturalIntent('cto update me').intent, 'summary');
assert.strictEqual(parseNaturalIntent('what is blocked').intent, 'risks');
assert.strictEqual(parseNaturalIntent('sir inniku progress iruka').intent, 'current_work');
assert.strictEqual(parseNaturalIntent('cto are we stuck').intent, 'current_work');
assert.strictEqual(parseNaturalIntent('coder swipe issue fixed ah').topic, 'swipe feel');
assert.strictEqual(parseNaturalIntent('cto operational assistance').intent, 'operational');
assert.strictEqual(parseNaturalIntent('hi').intent, 'greeting');
assert.strictEqual(isStandaloneGreeting('hi'), true);
assert.strictEqual(isStandaloneGreeting('hello'), true);
assert.strictEqual(isStandaloneGreeting('sup'), true);
assert.strictEqual(isStandaloneGreeting('bro'), true);
assert.strictEqual(isStandaloneGreeting('da'), true);
assert.strictEqual(isStandaloneGreeting('hey'), true);
assert.strictEqual(isStandaloneGreeting('\u0b8e\u0ba9\u0bcd\u0ba9'), true);
assert.strictEqual(isStandaloneGreeting('vanakkam'), true);
assert.strictEqual(isStandaloneGreeting('hey auditor'), false);
assert.strictEqual(parseNaturalIntent('bro you there').intent, 'check_in');
assert.strictEqual(parseNaturalIntent('good job').intent, 'praise');
assert.strictEqual(parseNaturalIntent('what should we do next').intent, 'direction');
assert.strictEqual(parseNaturalIntent('what did you just fix').intent, 'recent_fix_question');
assert.strictEqual(parseNaturalIntent('bro how work is going').intent, 'status_question');
assert.strictEqual(parseNaturalIntent('work epdi poguthu').intent, 'status_question');
assert.strictEqual(parseNaturalIntent('everything okay ah').intent, 'status_question');
assert.strictEqual(parseNaturalIntent('status enna da').intent, 'status_question');
assert.strictEqual(parseNaturalIntent('enna panreenga').intent, 'status_question');
const coderDirectiveIntent = parseNaturalIntent('hey cto tell the coder to check for new issues');
assert.strictEqual(coderDirectiveIntent.intent, 'directive');
assert.strictEqual(coderDirectiveIntent.directive.targetAgent, 'coder');
assert.strictEqual(coderDirectiveIntent.directive.action, 'check_new_issues');
const auditorCrossCheckIntent = parseNaturalIntent('hey auditor check what coder missed');
assert.strictEqual(auditorCrossCheckIntent.agent, 'auditor');
assert.strictEqual(auditorCrossCheckIntent.intent, 'cross_agent_audit');
assert.strictEqual(auditorCrossCheckIntent.topic, 'coder missed work');
const newAgentRequest = parseSpawnRequest('cto assign a new agent to do this work');
assert.strictEqual(newAgentRequest.autoApprove, true);
assert.strictEqual(newAgentRequest.name, 'Focused Specialist');
assert.strictEqual(shouldUseGeneralFallback('hello'), true);
assert.strictEqual(shouldUseGeneralFallback('whats going on'), true);

const status = routeMessage('status', sampleState).response;
assert(status.includes('Founder, CTO status'));
assert(status.includes('Health: 25/100'));
assert(status.includes(':app:lintDebug: PASSED'));

const buildNow = routeMessage('build now', sampleState);
assert.strictEqual(buildNow.command, 'build_now');
assert(buildNow.response.includes('OTA build requested'));

const fixLimit = routeMessage('fix limit', sampleState);
assert.strictEqual(fixLimit.command, 'fix_limit');
assert(fixLimit.response.includes('DeepSeek fix limit'));
assert(fixLimit.response.includes('/20'));
assert(fixLimit.response.includes('Remaining today'));

const executionStatus = routeMessage('execution status', sampleState);
assert.strictEqual(executionStatus.command, 'execution_status');
assert(executionStatus.response.includes('execution status'));
assert(executionStatus.response.includes('Commit:'));
assert(executionStatus.response.includes('Push:'));

const executionHistory = routeMessage('execution history', sampleState);
assert.strictEqual(executionHistory.command, 'execution_history');
assert(executionHistory.response.includes('Recent execution history'));

const risks = routeMessage('risks', sampleState).response;
assert(risks.includes('Hardcoded Secret'));
assert(risks.includes('Fix available'));
assert(risks.includes('Reply FIX'));

const skip = routeMessage('SKIP', sampleState);
assert.strictEqual(skip.command, 'execution_skip');
assert(skip.response.includes('No file changed'));

const focus = routeMessage('focus chaos', sampleState).response;
assert(focus.includes('focus set: chaos'));

const lowInfo = routeMessage('banana quantum potato', sampleState);
assert.strictEqual(lowInfo.command, 'noise_signal_ignored');
assert(lowInfo.response.includes('NOISE / STRESS TEST DETECTED'));
assert(lowInfo.response.includes('No FIX loop opened'));
assert(!lowInfo.response.includes('quick CTO update'));

const ambiguousIntent = routeMessage('do the thing', sampleState);
assert.strictEqual(ambiguousIntent.command, 'low_information');
assert(ambiguousIntent.response.includes('AMBIGUOUS INTENT DETECTED'));
assert(!ambiguousIntent.response.includes('Options:'));

const preservation = routeMessage('enter preservation mode', sampleState);
assert.strictEqual(preservation.command, 'preservation_mode_enabled');
assert(preservation.response.includes('PRESERVATION MODE ENABLED'));
assert(!preservation.response.includes('Starting execution now'));
const preservationWrite = routeMessage('create a file called preservation_test.txt', sampleState);
assert.strictEqual(preservationWrite.command, 'preservation_mode_blocked');
assert(preservationWrite.response.includes('BLOCKED'));
setMode('ACTIVE', 'test reset');

const unknown = routeMessage('repo update', sampleState);
assert.strictEqual(unknown.command, 'agent');
assert(unknown.response.includes('CTO'));

const hello = routeMessage('hello', sampleState);
assert.strictEqual(hello.command, 'agent');
assert(hello.response.includes('team is ready'));
assert(hello.response.includes('CODER'));
assert(hello.response.includes('AUDITOR'));

const hi = routeMessage('hi', sampleState);
assert.strictEqual(hi.matchedRoute, 'greeting_first');
assert.strictEqual(hi.response, [
  '\uD83C\uDFAF CTO: Founder, team is ready. What would you like to prioritize today?',
  '\uD83D\uDD27 CODER: Ready.',
  '\u2696\uFE0F REVIEWER: Standing by.',
  '\uD83D\uDEA8 AUDITOR: Monitoring active.'
].join('\n'));
assert(!hi.response.includes('Health:'));

const checkIn = routeMessage('anyone home', sampleState);
assert.strictEqual(checkIn.command, 'agent');
assert(checkIn.response.includes('Founder, team is ready'));

const statusQuestion = routeMessage('how are we doing', sampleState);
assert.strictEqual(statusQuestion.command, 'agent');
assert(statusQuestion.response.includes('Work'));
assert(statusQuestion.response.includes('AUDITOR'));

const casualWork = routeMessage('bro how work is going', sampleState);
assert.strictEqual(casualWork.command, 'agent');
assert.strictEqual(casualWork.intent, 'status_question');
assert(casualWork.response.includes('Work'));
assert(casualWork.response.includes('not calling everything clear'));
assert(casualWork.response.includes('CODER'));
assert(!casualWork.response.includes('Health:'));

const tanglishWork = routeMessage('work epdi poguthu', sampleState);
assert.strictEqual(tanglishWork.command, 'agent');
assert(tanglishWork.response.includes('Work'));
assert(!tanglishWork.response.includes('Health:'));

const coderDirective = routeMessage('hey cto tell the coder to check for new issues', sampleState);
assert.strictEqual(coderDirective.command, 'agent');
assert.strictEqual(coderDirective.intent, 'directive');
assert(coderDirective.response.includes('CODER'));
assert(coderDirective.response.includes('new issues'));
assert(!coderDirective.response.includes('context not fully verified'));

const followUpFix = routeMessage('fix it', sampleState, {
  recentMessages: [
    {
      role: 'agent',
      intent: 'directive',
      targetAgent: 'coder',
      action: 'check_new_issues',
      summary: 'CTO assigned Coder to check new issues.'
    }
  ],
  lastRequestedAction: 'check_new_issues',
  unresolvedReference: 'new issues',
  lastAgentInteraction: 'cto'
});
assert.strictEqual(followUpFix.command, 'agent');
assert(followUpFix.response.includes('Continuing'));
assert(followUpFix.response.includes('new issues'));
assert(followUpFix.response.includes('CODER'));
assert(!followUpFix.response.includes('context not fully verified'));

const auditorCrossCheck = routeMessage('hey auditor check what coder missed', sampleState);
assert.strictEqual(auditorCrossCheck.command, 'agent');
assert.strictEqual(auditorCrossCheck.agent, 'auditor');
assert.strictEqual(auditorCrossCheck.intent, 'cross_agent_audit');
assert(auditorCrossCheck.response.includes('AUDITOR'));
assert(auditorCrossCheck.response.includes('Coder missed'));
assert(!auditorCrossCheck.response.startsWith('🎯 CTO'));

const praise = routeMessage('good job team', sampleState);
assert.strictEqual(praise.command, 'agent');
assert(praise.response.includes('Thank you, Founder'));

const direction = routeMessage('what should we do next', sampleState);
assert.strictEqual(direction.command, 'agent');
assert(direction.response.includes('Recommended next move'));

const recentFix = routeMessage('what did you just fix', sampleState, {
  recentMessages: [
    { role: 'agent', intent: 'execution_fix', summary: 'Fixed README.md whitespace safely.' }
  ],
  latestImprovement: 'Fixed README.md whitespace safely.'
});
assert.strictEqual(recentFix.command, 'agent');
assert(recentFix.response.includes('README.md whitespace'));

const coder = routeMessage('hey coder what are you doing', sampleState).response;
assert(coder.startsWith('🔧 CODER'));
assert(coder.includes('Attempted:'));
assert(coder.split('\n').length <= 5);
assert(!coder.includes('I finished keyboard cleanup'));

const reviewer = routeMessage('reviewer any risks', sampleState).response;
assert(reviewer.startsWith('⚖️ REVIEWER'));
assert(reviewer.includes('Risk:'));

const auditor = routeMessage('auditor any dangerous issues', sampleState).response;
assert(auditor.startsWith('🚨 AUDITOR'));
assert(auditor.includes('Risk:'));

assert(routeMessage('cto update me', sampleState).response.startsWith('🎯 CTO'));
assert(routeMessage('cto active tasks', sampleState).response.startsWith('🎯 CTO'));
assert(routeMessage('hey auditor', sampleState).response.startsWith('🚨 AUDITOR'));
assert(routeMessage('hey auditer', sampleState).response.startsWith('🚨 AUDITOR'));
assert(routeMessage('audit status', sampleState).response.startsWith('🚨 AUDITOR'));
assert(routeMessage('reviewer update', sampleState).response.startsWith('⚖️ REVIEWER'));
assert(routeMessage('cto active tasks', sampleState).response.includes('Next:'));
assert(routeMessage('coder what are you working on', sampleState).response.includes('Attempted:'));
assert(routeMessage('reviewer blocked items', sampleState).response.includes('Blocked:'));
assert(routeMessage('auditor critical risks', sampleState).response.includes('danger'));
assert(routeMessage('cto maintenance status', sampleState).response.startsWith('🎯 CTO'));
assert(routeMessage('coder what was cleaned', sampleState).response.includes('No major typing improvement yet'));
assert(routeMessage('reviewer maintenance risks', sampleState).response.includes('Risk:'));
assert(routeMessage('auditor dangerous maintenance actions', sampleState).response.includes('danger'));
assert.strictEqual(parseNaturalIntent('cto execution status').intent, 'execution');
assert(routeMessage('cto execution status', sampleState).response.startsWith('🎯 CTO'));
assert(routeMessage('coder execution update', sampleState).response.startsWith('🔧 CODER'));
assert(routeMessage('reviewer blocked execution', sampleState).response.startsWith('⚖️ REVIEWER'));
assert(routeMessage('auditor dangerous execution attempts', sampleState).response.includes('danger'));
assert.strictEqual(parseNaturalIntent('cto full report').detailMode, true);
const detailed = routeMessage('cto detailed update', sampleState).response;
assert(detailed.includes('REALITY CHECK'));
assert(detailed.split('\n').length > 5);

const casual = routeMessage('dei what doing', sampleState).response;
assert(casual.includes('CTO'));
assert(casual.includes('Founder'));
assert(casual.split('\n').length <= 5);

const dangerous = routeMessage('reviewer anything dangerous', sampleState).response;
assert(dangerous.includes('REVIEWER'));
assert(dangerous.includes('Risk:'));

const progress = routeMessage('sir inniku progress iruka', sampleState).response;
assert(progress.includes('CTO'));
assert(progress.includes('No major typing improvement yet'));

const stuck = routeMessage('cto are we stuck', sampleState).response;
assert(stuck.includes('CTO'));
assert(stuck.includes('Blocked:'));

const swipe = routeMessage('coder swipe issue fixed ah', sampleState).response;
assert(swipe.includes('CODER'));
assert(swipe.includes('swipe line not proven fixed yet'));

const operational = routeMessage('cto operational assistance', sampleState).response;
assert(operational.includes('CTO'));
assert(operational.includes('product signals'));
assert(operational.includes('LOW OPERATIONAL IMPACT'));
assert(operational.split('\n').length <= 5);

const xml = twiml('Founder, 5 < 6 & safe');
assert(xml.includes('&lt;'));
assert(xml.includes('&amp;'));

assert.strictEqual(normalizePhone('whatsapp:+123 456'), '+123456');
assert.deepStrictEqual(extractTwilioBody({ body: undefined }).body, '');
assert.deepStrictEqual(extractTwilioBody({ body: { Body: 'hi', From: 'whatsapp:+1', MessageSid: 'SM1' } }).body, 'hi');

const spawnBackup = fs.existsSync(SPAWN_FILE) ? fs.readFileSync(SPAWN_FILE, 'utf8') : null;
try {
  const beforeIds = new Set(readSpawnState().active.map((agent) => agent.id));
  const coreBrains = ensureCoreAgentBrains();
  assert.deepStrictEqual(Object.keys(coreBrains).sort(), CORE_AGENTS.slice().sort());
  for (const agent of CORE_AGENTS) {
    const brain = readCoreAgentBrain(agent);
    assert.strictEqual(brain.agentId, agent);
    assert.strictEqual(brain.sharedDirection.directionId, 'aritenis-roadmap-2026-2027');
    assert.strictEqual(brain.sharedDirection.ctoOwnsPriority, true);
    if (agent !== 'cto') assert.strictEqual(brain.reportsTo, 'CTO');
  }
  const routedCoderBrain = routeMessage('hey coder what are you doing', sampleState);
  assert.strictEqual(routedCoderBrain.agent, 'coder');
  const coderBrain = readCoreAgentBrain('coder');
  assert.strictEqual(coderBrain.memory.lastInteraction.intent, 'current_work');
  assert.strictEqual(coderBrain.memory.lastInteraction.agent, 'coder');
  assert.strictEqual(coderBrain.sharedDirection.ctoOwnsPriority, true);
  const routedAuditorBrain = routeMessage('hey auditor check what coder missed', sampleState);
  assert.strictEqual(routedAuditorBrain.agent, 'auditor');
  const auditorBrain = readCoreAgentBrain('auditor');
  assert.strictEqual(auditorBrain.memory.lastInteraction.intent, 'cross_agent_audit');
  assert.strictEqual(auditorBrain.memory.lastInteraction.agent, 'auditor');

  const assigned = routeMessage('cto assign a new agent to do this work', sampleState, {
    lastDiscussedTopic: 'new issue audit',
    unresolvedReference: 'new issues'
  });
  assert.strictEqual(assigned.command, 'specialist_assigned');
  assert(assigned.response.includes('Created specialist'));
  const after = readSpawnState();
  const created = after.active.find((agent) => !beforeIds.has(agent.id));
  assert(created);
  assert(created.brainFile);
  assert(fs.existsSync(path.join(path.resolve(__dirname, '..', '..'), created.brainFile)));
} finally {
  if (spawnBackup == null) {
    if (fs.existsSync(SPAWN_FILE)) fs.unlinkSync(SPAWN_FILE);
  } else {
    fs.writeFileSync(SPAWN_FILE, spawnBackup);
  }
  if (fs.existsSync(AGENT_BRAIN_DIR)) {
    for (const file of fs.readdirSync(AGENT_BRAIN_DIR)) {
      const full = path.join(AGENT_BRAIN_DIR, file);
      if (initialBrainBackup.has(file)) fs.writeFileSync(full, initialBrainBackup.get(file));
      else fs.unlinkSync(full);
    }
  }
}

console.log('WhatsApp CTO interface checks passed.');
