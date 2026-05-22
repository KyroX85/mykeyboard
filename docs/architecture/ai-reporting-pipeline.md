# AI Reporting + Notification MVP

## Workflow architecture

1. Existing pipeline completes audits/fixes/verification.
2. `run-reporting.ps1` executes post-verification.
3. `generate-founder-report.ps1` builds:
   - `founder-report.md`
   - `founder-report.json`
   - `summary.md`
   - optional `summary.discord.txt` and `summary.telegram.txt`
4. `send-email-summary.ps1` sends report email over SMTP.
5. Reporting status is written to `.ai-pipeline/reports/latest/reporting-status.json`.

## Reliability-first behavior

- Report generation and email delivery are separate stages.
- If report generation fails, exit code `3`.
- If email fails, exit code `4` with report artifacts still preserved.
- Missing SMTP env vars fail fast with explicit errors.
- Email retries use incremental backoff.
- Email sending is rate-limited with local state.

## Security controls

- Sensitive patterns are redacted from generated report text.
- Reports avoid secrets, tokens, passwords, and keystroke content.
- SMTP credentials come only from environment variables.
- No secrets are written to report files.

## Rollback safety

- Reporting stage is read-only relative to source code.
- Failure in reporting does not mutate app code.
- Existing pipeline artifacts remain untouched.

## Future scaling path

1. Add SARIF output for CI ingestion.
2. Add weekly trend rollups from `history/report-index.jsonl`.
3. Add Slack/Discord/Telegram push integrations using webhook senders.
4. Add team routing rules (severity-based recipients).
5. Add signed report bundles for compliance trails.
