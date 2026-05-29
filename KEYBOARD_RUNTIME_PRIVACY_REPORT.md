# KEYBOARD_RUNTIME_PRIVACY_REPORT

Generated: 2026-05-29

## WHAT WAS VERIFIED

- `KeyboardService.currentWord`, `contextWords`, commit paths, swipe paths, debug logs, metrics flush, Supabase helper, and ProductSignalBridge.
- `KeyboardMetrics`, `KeyboardUsageSnapshot`, `KeyboardMetricsSnapshot`, `TopAcceptedWord`, and `privacyKey()`.
- `BasicPredictor` learning, persistence, and model load/save code.

## VERIFIED DATA TYPES

| Component | Raw typed text? | Classification |
|---|---:|---|
| `currentWord` | Yes | ACTIVE in-memory runtime need |
| `contextWords` | Yes | ACTIVE in-memory short context |
| `BasicPredictor` maps | Yes | ACTIVE local personalization |
| `BasicPredictor` SharedPreferences JSON | Yes | ACTIVE local persistence |
| `KeyboardUsageSnapshot` | No | VERIFIED SAFE aggregate |
| `KeyboardMetricsSnapshot.topAcceptedWords` | No raw words | VERIFIED SAFE hashed keys |
| `ProductSignalBridge` payload | No | VERIFIED SAFE aggregate |
| Android metric log line | No | VERIFIED SAFE aggregate |

## WHAT REMAINS THEORETICAL

- Android backup behavior for SharedPreferences was not proven from source.
- Future debug logging could accidentally include raw `currentWord`.
- Future Supabase callers could serialize raw text.

## ACTIVE RISKS

- Predictor personalization stores learned raw words locally in JSON.
- Debug swipe reports can include swipe sequences/candidate words in debuggable builds.

## DEAD CODE RISKS

- `logMetricSnapshot()` and `logEvent()` remain in runtime source even though current metrics flow uses `ProductSignalBridge`.

## DATA LEAK POSSIBILITY

External leak path from keyboard runtime: none verified.

Local typed-word storage path: verified.

## UNVERIFIED PATHS

- Device backup/export.
- OEM/system crash collection.
- Runtime production logcat handling outside source.

## PROOF OF SAFETY

- `usageSnapshot()` has only numbers/rates/durations/zone counters.
- `recordSuggestionAccepted()` hashes accepted words before metric snapshots.
- `ProductSignalBridge` does not read `currentWord`, `typedWord`, `contextWords`, or predictor model maps.
- Swipe warning logs now report sequence length and previous-word presence instead of raw values.

## RECOMMENDED HARDENING

1. Provide a private-learning toggle or hash/encrypt local predictor persistence.
2. Add Android backup rules for predictor SharedPreferences.
3. Keep debug swipe diagnostics disabled in release builds.
4. Add guardrails against raw text in network payload builders.

## RISK SEVERITY

MEDIUM.

## TRUST IMPACT

Runtime aggregate metrics are privacy-safe by current evidence. Local personalization is the real privacy obligation and should be disclosed or made optional.
