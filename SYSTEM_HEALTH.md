# Aritenis AI CTO System Health

## Operational Hardening Status

Phase 4 adds operational hardening only. It does not add autonomous code pushes, PR generation, destructive automation, or self-modifying workflows.

## Runtime Components

- GitHub Actions engineering worker: scheduled analysis every 6 hours.
- `ai-cto/brain.js`: deterministic analysis engine.
- `ENGINEERING_REPORT.md`: latest founder-readable report.
- `ai-cto/.brain_state.json`: persistent engineering memory.
- Render webhook server: WhatsApp read-only conversational interface.
- Twilio WhatsApp: transport layer.

## Health Endpoints

Render should expose:

```text
GET /healthz
GET /system-health
```

`/healthz` is suitable for Render health checks. `/system-health` returns deeper diagnostics:

- startup self-check result
- required file checks
- Twilio configuration status
- Founder allowlist configuration status
- workflow freshness
- rate limit and abuse protection settings

## Failure Detection

The webhook detects stale CTO state when the latest analysis timestamp is older than 12 hours.

If stale, WhatsApp `status` replies include a heartbeat warning:

```text
Heartbeat: CTO analysis is stale for <hours>h. GitHub Actions may be failing.
```

This is intentionally read-only. It reports the failure but does not mutate workflows or push code.

## Security Controls

- Twilio signature validation.
- Founder phone number allowlist.
- Sender abuse strike tracking.
- Per-sender rate limiting.
- Per-command cooldowns.
- Webhook replay protection using Twilio `MessageSid`.
- XML escaping for Twilio responses.
- Structured audit logging with masked phone numbers.

## Reliability Controls

- Startup self-check diagnostics.
- Handler failure recovery.
- Runtime memory corruption recovery.
- Repo memory JSON corruption recovery with backup file creation.
- Log rotation at 512 KB.
- Runtime WhatsApp memory cleanup after 30 days.
- Message chunking for long Twilio replies.

## Deployment Validation Checklist

Before production use:

- Render service deploys from `main`.
- Build command is `npm install`.
- Start command is `npm run cto:whatsapp`.
- Health check path is `/healthz`.
- `NODE_ENV=production`.
- `PUBLIC_BASE_URL` exactly matches the Render service URL.
- `TWILIO_AUTH_TOKEN` is set.
- `FOUNDER_WHATSAPP_NUMBER` is set in international format.
- Twilio webhook method is `POST`.
- Twilio webhook URL is `https://<render-service>.onrender.com/twilio/whatsapp`.
- `/healthz` returns `ok: true`.
- `/system-health` returns `ok: true`.
- WhatsApp `status` returns a CTO status block.
- WhatsApp duplicate delivery with the same `MessageSid` is ignored.
- Rapid repeated commands trigger cooldown/rate-limit protection.

## Operational Runbook

If WhatsApp replies stop:

1. Open Render logs.
2. Check `/healthz`.
3. Check `/system-health`.
4. Verify `TWILIO_AUTH_TOKEN`.
5. Verify `PUBLIC_BASE_URL` matches Render exactly.
6. Verify Twilio webhook method is `POST`.
7. Send `status` from the Founder phone only.

If reports are stale:

1. Open GitHub Actions.
2. Check the latest `Engineering Maintenance Worker` run.
3. Inspect failures in Android validation or email steps.
4. Do not change the WhatsApp webhook first; stale reports usually mean the scheduled worker failed.

If memory corruption is detected:

1. The webhook creates a `.corrupt-*` backup.
2. The webhook writes a safe recovered JSON shape.
3. Inspect the backup manually before restoring anything.

## Rollback Instructions

Lowest-risk rollback:

1. Remove the Twilio webhook URL or pause the Render service.
2. GitHub Actions and email reports continue normally.

Code rollback:

```bash
git revert d083c29
git revert <phase-4-commit>
```

Rollback complexity: low. The webhook is separate from the GitHub Actions engineering worker.

## Readiness Score

Operational hardening readiness: 90/100.

Remaining gaps before execution-capable WhatsApp control:

- persistent external audit storage
- signed approval directives
- human review enforcement for task execution
- durable cross-restart abuse cache
