# AI Reporting and Notification MVP

This module extends an existing AI engineering pipeline with:

- executive-grade report generation
- machine-readable JSON output
- email-friendly summary generation
- SMTP email delivery with retries and rate limiting

It is local-first and designed to run after your existing pipeline finishes.

## Expected inputs from existing pipeline

Place your current outputs in:

- `.ai-pipeline/reports/latest/audit.json`
- `.ai-pipeline/reports/latest/verification.json`
- `.ai-pipeline/reports/latest/performance.json` (optional)
- `.ai-pipeline/reports/latest/architecture.json` (optional)
- `.ai-pipeline/reports/latest/safe-fixes.json` (optional)
- `.ai-pipeline/reports/latest/dangerous-changes.json` (optional)

## Run full operating loop

```powershell
powershell -ExecutionPolicy Bypass -File .\.ai-pipeline\scripts\run-full-pipeline.ps1 -Mode Verify
```

## Run reporting only

```powershell
powershell -ExecutionPolicy Bypass -File .\.ai-pipeline\scripts\run-reporting.ps1 -Status PASSED
```

## Git hooks

The repository is configured with:

```powershell
git config core.hooksPath .githooks
```

- `post-commit` runs `AuditOnly` and never blocks commits.
- `pre-push` runs `Verify` and blocks failed required Gradle tasks or dangerous changes.

## Env configuration

Copy `.ai-pipeline/config/reporting.env.example` into your environment and set secrets as env vars in your shell/session manager.
