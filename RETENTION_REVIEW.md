# Retention Review

## 1. Why users would stay over Gboard

- Swipe and tap behavior remain stable across long sessions with lower correction pressure.
- Local-only learning improves friction prioritization without storing typed content.
- Symbol access is faster for common punctuation and operator keys through predictable long-press mappings.
- Product behavior is governed and bounded, reducing surprise regressions.

## 2. What still breaks trust

- Inconsistent swipe outcomes on very noisy paths where candidate confidence is close.
- Perceived delay if swipe resolution spikes on low-end devices.
- Any accidental regression in symbol muscle memory.
- Any privacy ambiguity around local learning artifacts.

## 3. What causes friction spikes

- Consecutive swipe failures followed by backspace bursts.
- High mode-switch and symbol-hunting frequency during mixed text/coding chats.
- Edge-heavy touch sessions with repeated corrections.
- Long gesture sessions where resolve latency crosses frame hitch thresholds.

## 4. What still feels immature

- Long-word swipe reliability under extreme noisy transit remains medium, not best-in-class.
- Local product learning confidence is still early due limited real-device aggregate volume.
- Dark-mode clarity is improved but not yet validated across diverse OLED/low-brightness devices.

## 5. Which subsystem most hurts retention

Swipe trust remains the highest retention risk because users quickly abandon keyboards when swipe confidence drops during daily fast typing.

## 6. What should not be touched yet

- Predictor architecture rewrites.
- Swipe architecture rewrites.
- Cloud learning/telemetry uploads.
- Geometry/spacing churn without strong real-device evidence.

## 7. Highest-impact improvements next

- Continue conservative swipe resolver tuning backed by replay tests only.
- Track and reduce swipe-resolve latency spikes in aggregate metrics.
- Validate symbol long-press adoption and correction-rate impact from real-device sessions.
- Expand edge-key confidence evidence before geometry changes.

## 8. What evidence is still weak

- Multi-week retention cohorts tied to swipe trust deltas.
- Device-bucket breakdown for latency and frame hitch suspicion.
- Quantified improvement from new long-press symbol mappings in real usage.
- Confidence of long-word swipe recovery under noisy one-hand gestures.
