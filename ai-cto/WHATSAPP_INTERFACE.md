# Aritenis AI CTO WhatsApp Interface

## Phase 3 Scope

This phase adds a lightweight deterministic WhatsApp conversational CTO interface for the Founder.

Implemented:

- Twilio webhook endpoint
- Twilio outbound sender with Meta WhatsApp Business Cloud API fallback
- Incoming WhatsApp parsing
- Command router
- CTO response generator
- Health, status, momentum, risk, approval, and focus query support
- Read-only access to latest CTO report and engineering memory
- Small local conversation memory
- Webhook request logging
- Failure recovery
- Malformed command handling
- Per-sender rate limiting
- Command cooldowns
- Webhook replay protection
- Startup self-check diagnostics
- Workflow stale heartbeat after 12 hours
- Compressed report summaries
- Message chunking for long responses
- Repo memory corruption recovery

Not implemented yet:

- Approval execution
- Directive system
- Task assignment
- Safe maintenance PR generation from WhatsApp

## Architecture Changes

GitHub Actions remains the analysis engine. It continues to run Android validation, update CTO memory, open maintenance PRs, and email the Founder.

Render hosts a small Node webhook server:

```text
Founder WhatsApp
  -> Twilio WhatsApp Sandbox or Twilio WhatsApp sender
  -> Render webhook /twilio/whatsapp
  -> ai-cto/.brain_state.json + ENGINEERING_REPORT.md + validation-results.json
  -> deterministic CTO response
  -> Twilio WhatsApp reply
```

The webhook does not run the Android build, does not call paid AI APIs, and does not modify the repository.
Deferred outbound replies and scheduled reports use Twilio first. If Twilio is unconfigured, rate-limited, or returns a send failure, the sender attempts Meta WhatsApp Business Cloud API next when Meta credentials are configured.

## Files Added

- `ai-cto/whatsapp-server.js`
- `ai-cto/whatsapp/command-router.js`
- `ai-cto/whatsapp/response-generator.js`
- `ai-cto/whatsapp/state-reader.js`
- `ai-cto/whatsapp/memory-store.js`
- `ai-cto/whatsapp/webhook-log.js`
- `ai-cto/whatsapp/operational-guard.js`
- `ai-cto/whatsapp/diagnostics.js`
- `ai-cto/scripts/test-whatsapp-interface.js`
- `ai-cto/scripts/test-whatsapp-operational-hardening.js`
- `ai-cto/WHATSAPP_INTERFACE.md`
- `.env.example`
- `SYSTEM_HEALTH.md`

Simplification note: message chunking now lives in `ai-cto/whatsapp-server.js`; conversation memory helpers live in `ai-cto/whatsapp/memory-store.js`; agent personality formatting lives in `ai-cto/whatsapp/agent-router.js`.

## Files Modified

- `package.json`
- `.gitignore`

## Supported Commands

- `status`
- `health`
- `momentum`
- `latest risks`
- `unresolved`
- `what changed`
- `approvals`
- `pending approvals`
- `keyboard health`
- `cto summary`
- `focus <topic>`
- `help`

Legacy aliases still work for `risks`, `latest fixes`, `pending issues`, `next priorities`, and `weekly summary`.

## Multi-Agent Conversational Layer

Founder can also message workers naturally:

```text
hey coder what are you doing
reviewer any risks
cto summarize today
auditor any dangerous issues
```

Agents are deterministic role views over the same repo memory and report:

- CTO: orchestration, summaries, priorities, approvals, momentum
- Coder: recorded implementation work, files touched when available, next coding steps
- Reviewer: regression risks, validation concerns, architecture consistency
- Auditor: secrets, oversized files, dangerous code, stale systems

Rules:

- agents do not claim fake work
- agents do not invent progress
- agents do not simulate emotions
- agents stay read-only
- WhatsApp cannot trigger code pushes or PR generation

Replies are short mobile-readable blocks with engineering indicators:

- `✅` healthy/pass
- `⚠️` warning
- `🚨` critical or stalled
- `🎯` next priority

## Twilio Setup Requirements

Use the Twilio free WhatsApp Sandbox for Phase 1.

Required Twilio values:

- Account Auth Token
- Account SID
- WhatsApp Sandbox sender
- Founder WhatsApp number
- Incoming message webhook URL:

```text
https://<render-service-name>.onrender.com/twilio/whatsapp
```

Set the Twilio webhook method to `POST`.

## Meta WhatsApp Business API Fallback

Meta fallback is optional for outbound sends when Twilio cannot send. Meta inbound webhooks are also supported so the Meta test number can receive founder messages directly.

Required Meta values:

- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_GRAPH_VERSION` such as `v25.0`
- `META_WHATSAPP_TO` or `FOUNDER_WHATSAPP_NUMBER`
- `META_WHATSAPP_VERIFY_TOKEN` for Meta webhook verification
- `META_APP_SECRET` optional but recommended for signed webhook validation

The fallback posts text messages to Meta Graph API:

```text
POST https://graph.facebook.com/<version>/<phone-number-id>/messages
```

The payload uses `messaging_product=whatsapp`, recipient phone number, and a text body. Media URLs are appended as text links in Meta fallback mode; Twilio still uses `MediaUrl`.

Meta webhook setup:

```text
Callback URL: https://<render-service-name>.onrender.com/meta/whatsapp
Verify token: same value as META_WHATSAPP_VERIFY_TOKEN
Webhook field: messages
```

Twilio can remain pointed at:

```text
https://<render-service-name>.onrender.com/twilio/whatsapp
```

## Render Deployment Steps

Create a free Render Web Service from the GitHub repo.

Settings:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm run cto:whatsapp`
- Health check path: `/healthz`

Environment variables:

- `NODE_ENV=production`
- `PORT` is provided by Render
- `PUBLIC_BASE_URL=https://<render-service-name>.onrender.com`
- `WHATSAPP_PROACTIVE_MESSAGES_ENABLED=false` to pause automatic outbound messages and protect quota
- `TWILIO_AUTH_TOKEN=<twilio-auth-token>`
- `TWILIO_ACCOUNT_SID=<twilio-account-sid>`
- `TWILIO_WHATSAPP_FROM=whatsapp:+<twilio-sender>`
- `META_WHATSAPP_ACCESS_TOKEN=<meta-cloud-api-token>`
- `META_WHATSAPP_PHONE_NUMBER_ID=<meta-phone-number-id>`
- `META_WHATSAPP_GRAPH_VERSION=v25.0`
- `META_WHATSAPP_VERIFY_TOKEN=<private-random-string-used-in-meta-webhook-setup>`
- `META_APP_SECRET=<meta-app-secret-optional-recommended>`
- `FOUNDER_WHATSAPP_NUMBER=+<country-code-and-number>`
- `WHATSAPP_RATE_LIMIT_WINDOW_MS=60000`
- `WHATSAPP_RATE_LIMIT_MAX=12`
- `WHATSAPP_COMMAND_COOLDOWN_MS=3000`
- `WHATSAPP_REPLAY_WINDOW_MS=600000`
- `WHATSAPP_ABUSE_WINDOW_MS=900000`
- `WHATSAPP_ABUSE_MAX=8`

Do not set `ALLOW_UNVERIFIED_WHATSAPP=true` in production.

## Temporarily Pausing Proactive Messages

To avoid Twilio/Meta quota exhaustion, leave this unset or set it to `false`:

```text
WHATSAPP_PROACTIVE_MESSAGES_ENABLED=false
```

This blocks scheduled school-mode/proactive reports and the Render proactive vision steward. It does not block direct founder replies, requested screenshots, or requested command responses.

To re-enable proactive messages later:

```text
WHATSAPP_PROACTIVE_MESSAGES_ENABLED=true
```

## Security Risks

Primary risks:

- Exposed webhook endpoint
- Spoofed WhatsApp POST requests
- Wrong Founder phone number configuration
- Leaking CTO report details to unauthorized senders
- Render environment variable misconfiguration
- Render free-tier restart losing runtime-only WhatsApp memory

Implemented controls:

- Twilio signature validation
- Optional Meta `X-Hub-Signature-256` validation when `META_APP_SECRET` is configured
- Founder phone number allowlist
- Production config enforcement
- XML escaping for Twilio responses
- Twilio-first outbound provider fallback to Meta Cloud API
- Read-only webhook behavior
- Rate limiting
- Command cooldowns
- Replay protection with Twilio message IDs
- Masked webhook logging
- Handler failure recovery

## Health Monitoring

Render health check:

```text
GET /healthz
```

Detailed operational diagnostics:

```text
GET /system-health
```

If GitHub Actions has not updated CTO state for more than 12 hours, WhatsApp `status` responses include a heartbeat warning.

## Conversation Memory

The webhook stores lightweight runtime memory in `ai-cto/.whatsapp_memory.json`.

Tracked:

- last requested focus area
- latest unresolved issue
- last health score
- latest momentum state

This file is ignored by git because it is runtime state. The authoritative engineering memory remains `ai-cto/.brain_state.json`.

## Rollback Complexity

Rollback complexity: low.

Disable the Render service or remove the Twilio webhook URL. The GitHub Actions CTO reporting system continues to run normally because the WhatsApp server is separate.

## Validation Procedure

Local deterministic validation:

```bash
npm run cto:whatsapp:test
```

Direct scripts:

```bash
node ai-cto/scripts/test-whatsapp-interface.js
node ai-cto/scripts/test-whatsapp-operational-hardening.js
```

Render validation:

```text
GET https://<render-service-name>.onrender.com/healthz
```

Twilio validation:

1. Send `status` to the Twilio WhatsApp sandbox.
2. Confirm the reply starts with `Founder Sir, CTO status:`.
3. Send `risks`.
4. Confirm the reply lists the latest report risks.
5. Send `focus keyboard`.
6. Confirm the reply stores and reports the requested focus area.

## Production Readiness Score

Phase 4 readiness: 90/100.

It is ready for controlled Founder-only read-only CTO conversations through Twilio Sandbox and Render free tier. It is not ready for approval execution or task assignment until the next phase adds signed directives, durable audit logs, and PR-only execution controls.
