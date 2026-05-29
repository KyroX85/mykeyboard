# SUPABASE_AUDIT_REPORT

Generated: 2026-05-29

## WHAT WAS VERIFIED

- Searched for Supabase references, env vars, build config fields, SDK imports, upload endpoints, dataset sync files, and telemetry remnants.
- Inspected `app/build.gradle.kts`, `KeyboardService.kt`, workflows, and guardrail tests.

## FINDINGS

| Item | Classification | Evidence |
|---|---:|---|
| Supabase SDK dependency | VERIFIED SAFE | No Supabase/Postgrest SDK dependency exists; tests assert this stays absent. |
| Supabase URL/key packaging | ACTIVE | `app/build.gradle.kts` injects `ARITENIS_SUPABASE_URL` and `ARITENIS_SUPABASE_ANON_KEY` into `BuildConfig`. |
| Supabase runtime helper | THEORETICAL RISK | `KeyboardService.logEvent()` can POST arbitrary `dataPairs` to `/rest/v1/typing_logs`. |
| Active Supabase metric caller | DEAD/ARCHIVED current path | `logMetricSnapshot()` calls `logEvent()`, but no caller to `logMetricSnapshot()` was found. |
| Raw typed text upload | UNVERIFIED future risk; not found active | Current inspected metric fields are counters and hashed accepted-word keys. |
| Secrets in source | VERIFIED SAFE current source | No hardcoded Supabase URL/key found; values come from env/secrets. |
| `dataset-sync.js` | VERIFIED SAFE absent | No such file was found in the working tree. |

## WHAT REMAINS THEORETICAL

- Supabase table contents and policies cannot be verified locally.
- A future developer can accidentally pass raw text into `logEvent()`.

## ACTIVE RISKS

- Supabase credentials can be packaged into builds when CI secrets are set.
- The helper is generic and cloud-capable even if dormant today.

## DEAD CODE RISKS

- Dormant cloud upload code weakens the local-first guarantee because activation requires only one caller.

## DATA LEAK POSSIBILITY

Current verified raw typed-text leak to Supabase: none.

Future accidental leak possibility: real.

## UNVERIFIED PATHS

- Supabase row history.
- Supabase RLS/retention settings.
- Hosted logs containing previous Supabase errors.

## PROOF OF SAFETY

- `KeyboardMetrics.privacyKey()` hashes `topAcceptedWords` before metric reporting.
- `logMetricSnapshot()` is not called by current inspected runtime path.
- Supabase failure logs were hardened to avoid echoing serialized payloads.

## RECOMMENDED HARDENING

1. Remove Supabase logging from the IME runtime unless explicitly needed.
2. If retained, replace `Pair<String, Any>` payloads with aggregate-only typed fields.
3. Add a test that fails if `currentWord`, `typedWord`, or `previousWord` appears in Supabase payload construction.

## RISK SEVERITY

MEDIUM.

## TRUST IMPACT

Supabase is the main cloud-trust concern. No raw typed-text upload was proven active, but the helper should be removed or strongly constrained before claiming hard local-first privacy.
