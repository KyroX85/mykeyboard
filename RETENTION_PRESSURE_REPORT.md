# Retention Pressure Report

## 1) What causes users to lose trust fastest?

- Swipe commits that feel random or inconsistent.
- Autocorrect replacements that are immediately undone.
- Latency spikes during active typing or swipe release.
- Any perception that input was altered without clear confidence.

## 2) Which friction repeats daily?

- Symbol-layer switching overhead in mixed chat/coding usage.
- Backspace bursts after uncertain corrections.
- Retry loops after failed long-word swipes.

## 3) Which subsystem causes hidden fatigue?

Swipe reliability under noisy real-thumb gestures causes the largest hidden fatigue because users repeatedly self-correct and lose flow.

## 4) Which UX issue compounds over time?

Low-confidence corrections compound over time. Even small false replacements increase vigilance, and vigilance increases perceived effort.

## 5) Which improvements actually increase comfort?

- Conservative weak-signal gating in swipe resolution.
- Stricter short-word autocorrect confidence/margin gating.
- Faster symbol access for high-frequency punctuation/operators.
- Stable low-brightness key separation with calm contrast.
- Aggregate latency spike and swipe-resolve spike monitoring.

## 6) Which changes are cosmetic only?

- Micro tint adjustments without measurable correction/latency impact.
- Shadow/stroke tweaks that do not improve readability under low brightness.
- Report-only changes with no runtime or test impact.

## 7) Which regressions silently damage retention?

- Rising `backspaceAfterAutocomplete` with no obvious crash.
- Increased `repeatedSwipeFailureRuns` despite green builds.
- Higher `symbolLayerDependencyPercent` with no UI breakage.
- Gradual growth of `frameHitchSuspicions` in long sessions.

## 8) Which subsystem should remain frozen?

Core architecture and hot-path ownership boundaries in `KeyboardService.kt` should remain frozen except for high-confidence, test-backed trust fixes.

## 9) Which subsystem deserves careful iteration?

- `SwipeWordResolver.kt` and `SwipeGestureTracker.kt` for predictability tuning.
- `BasicPredictor.kt` autocorrect confidence gates.
- Symbol long-press map for high-frequency access rhythm.

## 10) Which improvements are highest confidence?

- Conservative weak-signal swipe commit suppression.
- Short-word autocorrect confidence/margin tightening.
- Swipe resolve latency spike counters.
- Local aggregate-only friction learning with faster weak-evidence decay.

