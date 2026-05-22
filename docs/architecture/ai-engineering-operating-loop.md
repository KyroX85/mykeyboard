# MyKeyboard AI Engineering Operating Loop

## Workflow Diagram

```text
Local change / AI-assisted edit
        |
        v
Git diff detects changed files
        |
        v
run-full-pipeline.ps1
        |
        +--> classify safe vs risky files
        +--> detect dangerous changes
        +--> optional deterministic safe fixes
        +--> Gradle verification
        +--> founder report generation
        +--> SMTP summary when verification passes
        |
        v
.ai-pipeline/reports/latest

git post-commit
        |
        v
AuditOnly mode, never blocks commit

git pre-push
        |
        v
Verify mode, blocks dangerous changes and failed required Gradle tasks

GitHub Actions
        |
        v
Cloud verifier only, uploads reports/logs/APK artifacts
```

## Entrypoint

All local and cloud automation should call:

```powershell
powershell -ExecutionPolicy Bypass -File .\.ai-pipeline\scripts\run-full-pipeline.ps1 -Mode Verify
```

Supported modes:

- `AuditOnly`: lightweight local audit/report generation.
- `Verify`: audit plus required Gradle verification.
- `Full`: same operating loop for explicit local runs.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Pipeline passed |
| 2 | Dangerous change detected; human approval required |
| 3 | Required verification failed |
| 5 | Pipeline infrastructure error |

## Dangerous-Change Logic

The detector blocks or flags:

- AndroidManifest changes.
- Permission changes.
- Exported component changes.
- Telemetry or Supabase payload/auth changes.
- Input method lifecycle changes.
- Threading, coroutine, handler, or async network changes.
- Dependency and Gradle build changes.
- Signing, release, or shrinker configuration changes.

Dangerous changes are never auto-fixed. They are written to `dangerous-changes.json` and a redacted diff is preserved under `.ai-pipeline/reports/latest/diffs`.

## Rollback Strategy

The pipeline does not auto-commit and does not auto-push.

Before deterministic safe fixes, it writes:

```text
.ai-pipeline/state/pre-safe-fix.patch
```

After safe fixes, it writes:

```text
.ai-pipeline/state/safe-fixes.patch
.ai-pipeline/reports/latest/diffs/safe-fixes.redacted.patch
```

If verification fails, the pipeline stops and preserves artifacts. Source rollback remains a human Git decision.

## Local vs Cloud Responsibility

| Layer | Responsibility |
| --- | --- |
| Local Git hooks | Fast audit, pre-push guardrail, founder reporting |
| Local PowerShell pipeline | Change classification, verification, report generation, email trigger |
| GitHub Actions | Cloud verification and artifact preservation |
| Supabase | Product telemetry, not pipeline state |
| Founder email | Decision-grade summary after verified local runs |

## Remaining Gaps

- Configure `JAVA_HOME` in the local shell running the pipeline.
- Add ktlint/detekt Gradle plugins if those checks should become enforced rather than skipped.
- Decide the human approval process for dangerous changes.
- Harden Supabase telemetry payloads to prevent raw typed content upload by default.
- Add CI secrets only if cloud email delivery becomes necessary.
