# PRIVACY_REALITY_REPORT

Generated: 2026-05-29

## WHAT WAS VERIFIED

- Searched the repo for typed text, raw text, word buffers, swipe paths, coordinates, serialization, network, Supabase, Firebase, telemetry, uploads, artifacts, logs, archives, screenshots, and WhatsApp paths.
- Inspected `KeyboardService.kt`, `KeyboardMetrics.kt`, `ProductSignalBridge.kt`, `BasicPredictor.kt`, `product-metrics-ingest.js`, `product-governance.js`, WhatsApp server/logging modules, and GitHub workflows.
- Verified current working tree archive names requested by the founder are absent: `database-aritenis-ARCHIVE`, `collected_data-ARCHIVE`, and `AritenisArchive-ARCHIVE`.

## PRIVACY ANSWERS

| Question | Status | Evidence |
|---|---:|---|
| Can raw typed text leave the device? | THEORETICAL RISK | No current verified path sends `currentWord` or committed text to cloud. Risk remains because `KeyboardService.logEvent()` is a generic Supabase POST helper. |
| Can typed words enter SQLite? | VERIFIED SAFE | No Room, `SQLiteOpenHelper`, `SQLiteDatabase`, app `.db`, or SQLite write path was found in the keyboard runtime. |
| Can typed words enter JSON logs? | ACTIVE RISK local persistence | `BasicPredictor.saveModel()` serializes learned raw words/bigrams into SharedPreferences JSON. Android metric logs do not log raw words. |
| Can typed words enter archives? | VERIFIED SAFE current tree; THEORETICAL historical risk | Current product evidence archive stores aggregate metrics only. Historical GitHub artifacts/history were not fully verifiable locally. |
| Can typed words enter Supabase? | THEORETICAL RISK | Current metric payloads are aggregate/hash-based and `logMetricSnapshot()` has no caller found, but `logEvent()` would upload arbitrary passed data. |
| Can typed words enter GitHub Actions artifacts? | THEORETICAL RISK | CI uploads reports/APKs/screenshots. No live user typing feed exists, but generated files or manual screenshots could be uploaded if misused. |
| Can typed words enter WhatsApp summaries? | VERIFIED SAFE for keyboard text; ACTIVE RISK for founder messages | No keyboard runtime-to-WhatsApp path found. Founder WhatsApp messages are routed and summarized by design. |
| Can typed words enter debug logs? | THEORETICAL RISK | Debug swipe logs are gated by debuggable builds and include swipe sequences/candidates, not full sentences. Warning logs were hardened to avoid raw swipe sequence/previous word. |
| Can typed words enter crash logs? | THEORETICAL RISK | No Crashlytics dependency/import was found. Android exception messages could still include accidental future data if added. |
| Can any network path accidentally serialize typed text? | THEORETICAL RISK | `ProductSignalBridge` sends aggregate-only local HTTP payloads. `logEvent()` can serialize arbitrary data to Supabase if misused. |

## WHAT REMAINS THEORETICAL

- Supabase table contents, retention, and RLS policies cannot be verified from local source.
- Historical GitHub Actions artifacts and external Render logs cannot be fully audited from the local checkout.
- Device backup behavior for app-private SharedPreferences depends on Android backup configuration/runtime.

## ACTIVE RISKS

- `BasicPredictor` locally stores learned typed words in SharedPreferences JSON.
- Founder WhatsApp messages are operational data and can enter agent memory/logging paths.

## DEAD CODE RISKS

- Dormant Supabase logging is not harmless: `logEvent()` is one call away from cloud upload.
- Product Lab screenshot upload is currently scripted/emulator-oriented, but future manual real-device use could capture personal content.

## DATA LEAK POSSIBILITY

- Verified raw typed-text cloud leak: none found.
- Verified local raw typed-word retention: yes, through predictor learning.
- Highest cloud-risk boundary: future misuse of `KeyboardService.logEvent()`.

## UNVERIFIED PATHS

- Git history and prior remote artifacts.
- Supabase dashboard/table state.
- Render/Twilio/Meta/NVIDIA provider retention.
- Device backup/export behavior outside the source tree.

## PROOF OF SAFETY

- `KeyboardUsageSnapshot` contains numeric aggregate fields only.
- `KeyboardMetrics.privacyKey()` hashes accepted suggestion words before metric reporting.
- `ProductSignalBridge.emitAggregateSignal()` builds aggregate counters only and does not read `currentWord`.
- `product-metrics-ingest.js` rejects raw-content-shaped keys and archives only sanitized aggregate evidence.
- Webhook logs now store founder message length, not message body.
- Supabase failure logs no longer echo serialized payloads.

## RECOMMENDED HARDENING

1. Remove Supabase runtime logging or replace it with an aggregate-only DTO allowlist.
2. Add a founder-approved privacy mode to disable or hash local predictor learning.
3. Add CI checks for `currentWord`/`typedWord` usage inside any network payload builder.
4. Keep Product Lab screenshots emulator/scripted-only by default.

## RISK SEVERITY

MEDIUM.

## TRUST IMPACT

High. Aritenis can say no raw typed-text cloud leak was found in current source, but it cannot say typed words are never stored because the local predictor persists learned words.
