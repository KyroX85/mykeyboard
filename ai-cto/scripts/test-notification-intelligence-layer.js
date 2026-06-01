const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  evaluateProactiveNotification,
  recordNotificationDecision
} = require('../whatsapp/notification-intelligence-layer');
const { readNotificationMemory } = require('../whatsapp/notification-memory');
const { checkNotificationDuplicate } = require('../whatsapp/notification-deduplication-engine');
const { classifyNotificationPriority } = require('../whatsapp/notification-priority-engine');
const { checkNotificationRateLimit } = require('../whatsapp/notification-rate-limiter');
const { metricsAreSourced } = require('../whatsapp/notification-self-check');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-intelligence-'));

try {
  const visionBody = [
    'Founder, one vision check.',
    'Company goal: help users understand confusing content before they type.',
    'Suggested improvement: define the smallest Explain wedge.'
  ].join('\n');

  const low = evaluateProactiveNotification({
    root,
    type: 'vision_check',
    body: visionBody,
    state: {},
    now: new Date('2026-05-31T08:00:00.000Z')
  });
  assert.strictEqual(low.allowed, false);
  assert.strictEqual(low.priority, 'LOW');
  assert.strictEqual(low.reason, 'not_useful');

  const fakeHealth = evaluateProactiveNotification({
    root,
    type: 'normal_status',
    body: 'Health 30/100. Momentum STALLED.',
    state: {},
    now: new Date('2026-05-31T09:00:00.000Z'),
    priorityOverride: 'MEDIUM',
    reason: 'forced test'
  });
  assert.strictEqual(fakeHealth.allowed, false);
  assert.strictEqual(fakeHealth.reason, 'no_evidence');
  assert.strictEqual(metricsAreSourced('Health 30/100. Momentum STALLED.', []), false);

  const buildFailureState = {
    validation: [{ task: ':app:assembleDebug', status: 'FAILED' }],
    sections: { risks: ['Build failed in GitHub Actions.'], unresolved: [], approvals: [] }
  };
  const critical = evaluateProactiveNotification({
    root,
    type: 'build_failure',
    body: 'Build failed in GitHub Actions. Action required: none yet.',
    state: buildFailureState,
    now: new Date('2026-05-31T10:00:00.000Z')
  });
  assert.strictEqual(critical.allowed, true);
  assert.strictEqual(critical.priority, 'CRITICAL');
  recordNotificationDecision(root, critical, {
    body: 'Build failed in GitHub Actions. Action required: none yet.',
    now: new Date('2026-05-31T10:00:00.000Z'),
    sent: true
  });

  const duplicate = evaluateProactiveNotification({
    root,
    type: 'build_failure',
    body: 'Build failed in GitHub Actions. Action required: none yet.',
    state: buildFailureState,
    now: new Date('2026-05-31T10:05:00.000Z')
  });
  assert.strictEqual(duplicate.allowed, false);
  assert.strictEqual(duplicate.reason, 'duplicate');
  assert(duplicate.dedupe.similarity >= 0.8);

  const memory = readNotificationMemory(root);
  const manualDedupe = checkNotificationDuplicate('Build failed in GitHub Actions. Action required: none yet.', memory);
  assert.strictEqual(manualDedupe.duplicate, true);

  const approvalState = {
    sections: { approvals: ['Founder approval required for protected hot-path patch.'], risks: [], unresolved: [] }
  };
  const high = classifyNotificationPriority({
    type: 'approval_request',
    body: 'Founder approval required for protected hot-path patch.',
    state: approvalState,
    now: new Date('2026-05-31T11:00:00.000Z')
  });
  assert.strictEqual(high.priority, 'HIGH');

  const rateMemory = {
    notifications: [
      { timestamp: '2026-05-31T07:00:00.000Z', priority: 'HIGH', type: 'approval_request', sent: true }
    ]
  };
  assert.strictEqual(checkNotificationRateLimit(rateMemory, {
    priority: 'HIGH',
    type: 'approval_request',
    now: new Date('2026-05-31T12:00:00.000Z')
  }).allowed, false);
  assert.strictEqual(checkNotificationRateLimit(rateMemory, {
    priority: 'HIGH',
    type: 'approval_request',
    now: new Date('2026-05-31T13:01:00.000Z')
  }).allowed, true);
  assert.strictEqual(checkNotificationRateLimit(rateMemory, {
    priority: 'CRITICAL',
    type: 'build_failure',
    now: new Date('2026-05-31T12:00:00.000Z')
  }).allowed, true);

  const mediumMemory = {
    notifications: [
      { timestamp: '2026-05-31T01:00:00.000Z', priority: 'MEDIUM', type: 'normal_status', sent: true }
    ]
  };
  assert.strictEqual(checkNotificationRateLimit(mediumMemory, {
    priority: 'MEDIUM',
    type: 'normal_status',
    now: new Date('2026-05-31T12:00:00.000Z')
  }).allowed, false);
  assert.strictEqual(checkNotificationRateLimit({ notifications: [] }, {
    priority: 'MEDIUM',
    type: 'vision_check',
    now: new Date('2026-05-31T12:00:00.000Z')
  }).reason, 'medium_digest_only');
  assert.strictEqual(checkNotificationRateLimit({ notifications: [] }, {
    priority: 'LOW',
    type: 'vision_check',
    now: new Date('2026-05-31T12:00:00.000Z')
  }).allowed, false);

  const repeatedIssueMemory = {
    founderActivity: { lastSeenAt: '2026-05-31T10:30:00.000Z' },
    notifications: [
      {
        timestamp: '2026-05-31T10:00:00.000Z',
        priority: 'HIGH',
        type: 'approval_request',
        summary: 'Founder approval required for protected hot-path patch.',
        summaryHash: 'same',
        sent: true
      }
    ]
  };
  const repeatedWithin24 = checkNotificationDuplicate(
    'Founder approval required for protected hot-path patch.',
    repeatedIssueMemory,
    { now: new Date('2026-06-01T09:59:00.000Z') }
  );
  assert.strictEqual(repeatedWithin24.duplicate, true);
  assert.strictEqual(repeatedWithin24.reason, 'duplicate_24h');

  const ignoredIssueMemory = {
    founderActivity: { lastSeenAt: '2026-05-31T09:00:00.000Z' },
    notifications: [
      {
        timestamp: '2026-05-31T10:00:00.000Z',
        priority: 'HIGH',
        type: 'approval_request',
        summary: 'Founder approval required for protected hot-path patch.',
        sent: true
      }
    ]
  };
  const ignoredRepeat = checkNotificationDuplicate(
    'Founder approval required for protected hot-path patch.',
    ignoredIssueMemory,
    { now: new Date('2026-06-02T12:00:00.000Z') }
  );
  assert.strictEqual(ignoredRepeat.duplicate, true);
  assert.strictEqual(ignoredRepeat.reason, 'founder_ignored_previous_issue');

  console.log('Notification intelligence layer checks passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
