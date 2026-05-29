# LOCAL_FIRST_VERIFICATION_REPORT

Generated: 2026-05-29

## WHAT WAS VERIFIED

- Android runtime dependencies, network callers, Supabase helper, local HTTP bridge, product evidence archive, WhatsApp sender paths, and CI workflows.

## LOCAL-FIRST STATUS

| Area | Classification | Evidence |
|---|---:|---|
| Live typing inference | VERIFIED SAFE local | Predictor/autocorrect/swipe logic runs in app code; no cloud AI in hot path. |
| Runtime product metrics | VERIFIED SAFE aggregate | `ProductSignalBridge` sends aggregate counters only to local/emulator endpoints. |
| Predictor learning | ACTIVE local storage | Learned words persist locally in app-private SharedPreferences JSON. |
| Supabase runtime helper | THEORETICAL RISK | Cloud POST helper remains in IME runtime source. |
| WhatsApp CTO | NOT keyboard runtime | Operational cloud messaging, not live typing path. |
| GitHub Product Lab | NOT device runtime | CI/emulator evidence path, not live user typing. |

## WHAT REMAINS THEORETICAL

- Device backup behavior for SharedPreferences.
- External provider retention.
- Historical artifact contents.

## ACTIVE RISKS

- Local raw-word predictor storage.
- Founder operational messages through WhatsApp/cloud providers.

## DEAD CODE RISKS

- Dormant Supabase helper conflicts with strict local-first trust even if not active today.

## DATA LEAK POSSIBILITY

No verified raw keyboard typed-text cloud path in current source.

## UNVERIFIED PATHS

- Supabase dashboard.
- Render logs.
- Firebase/GitHub artifact retention.

## PROOF OF SAFETY

- No Supabase SDK dependency.
- No Firebase Analytics/Crashlytics imports found in keyboard runtime.
- No SQLite runtime storage path found.
- Product intelligence ingestion stores sanitized aggregates only.
- Android metric logging avoids raw typed words.

## RECOMMENDED HARDENING

1. Remove or allowlist Supabase runtime logging.
2. Add user-facing privacy control for local predictor learning.
3. Add backup exclusion for predictor model storage.
4. Keep Product Lab and WhatsApp separated from live user typing.

## RISK SEVERITY

MEDIUM.

## TRUST IMPACT

Aritenis is mostly local-first in the live typing path, but the current source still cannot support an absolute "no typed words are stored" claim.
