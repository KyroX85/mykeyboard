# Keyboard Usage Intelligence Phase 1

## Scope

This phase adds local-only aggregate usage intelligence for Aritenis AI Keyboard. It does not change typing behavior, prediction ranking, swipe resolution, haptics, routing, layouts, telemetry architecture, or persistence architecture.

## Exact Metrics Collected

- Session duration: elapsed time from first active typing event until session reset.
- Key commits: aggregate count of successful commit-latency records.
- Backspace frequency: total backspaces and backspaces per 100 key commits.
- Rapid correction patterns: backspaces occurring within a bounded 700 ms correction window.
- Repeated missed-tap proxy: aggregate runs of 3 or more consecutive backspaces.
- Suggestion usefulness: suggestion impressions, accepted suggestions, and acceptance rate.
- Typing burst stability: bounded burst counts, longest burst, and correction-heavy burst stability score.
- Key confidence zones: aggregate buckets only for left edge, right edge, center alpha, bottom modifier, action edge, and unknown.

## Privacy Verification

- Local-only: metrics live in memory inside `KeyboardMetrics`.
- No raw keystrokes are stored.
- No sentences are stored.
- No raw accepted words are stored in usage intelligence.
- Suggestion acceptance continues to use existing hashed word keys for the older metrics snapshot.
- Key confidence uses coarse zones, not per-key text.
- No cloud upload path was added.
- No telemetry schema was changed.
- No SharedPreferences, disk, JSON, network, coroutine, or file usage exists in the usage metrics layer.

## Typing Confidence Indicators

- High backspaces per 100 commits can indicate thumb targeting problems or autocorrect distrust.
- Rapid correction backspaces can indicate immediate error recovery after a likely missed tap.
- Repeated correction runs can indicate stronger confidence breaks during fast typing.
- Edge-zone counts compared with correction rates can guide future edge-key ergonomics work without logging individual letters.

## Correction Hotspots

Phase 1 does not store per-key or per-word hotspots. It stores only coarse confidence zones. This intentionally limits observability to privacy-safe categories:

- left edge
- right edge
- center alpha
- bottom modifier
- action edge
- unknown

## Fatigue Indicators

- Longer sessions with rising correction-heavy burst counts suggest fatigue or density issues.
- Longest burst helps identify sustained typing load.
- Burst stability is aggregate and bounded, so it can identify unstable typing periods without retaining text.

## Suggestion Usefulness

- Acceptance rate measures whether visible suggestions are useful.
- Ignored suggestions remain available through the existing metrics snapshot.
- No prediction training behavior was modified.

## Runtime Impact

- Hot-path work is limited to primitive counter increments and elapsed-time comparisons.
- `ACTION_DOWN` records one enum bucket counter.
- Backspace records bounded correction timing counters.
- Commit latency recording also updates typing-burst counters.
- No allocations are introduced in `ACTION_MOVE`.
- No JSON, disk, network, coroutine, or logging work is added to typing events.

## Memory Impact

- One fixed `LongArray` sized to the `KeyConfidenceZone` enum.
- Additional primitive counters in `KeyboardMetrics`.
- No unbounded collections.
- No retained text buffers.
- Estimated steady-state memory impact: under 1 KB per keyboard service instance.

## Battery Estimate

- Idle impact: zero active timers or wakeups.
- Typing impact: negligible integer counter updates only.
- Flush behavior reuses existing metrics flushing cadence and does not add new background work.

## Guardrails

- Unit tests verify aggregated correction counters, zone counters, and suggestion acceptance metrics.
- Unit tests verify `KeyboardUsageSnapshot` has no sensitive text or iterable retention fields.
- Source guardrails verify the usage metrics layer does not add persistence, JSON, network, coroutine, file, or raw-keystroke paths.

## Probable UX Weak Areas This Can Reveal

- High edge-zone activity combined with correction bursts may indicate edge-key targeting weakness.
- High bottom-modifier activity with correction bursts may indicate action-row confidence issues.
- Low suggestion acceptance can indicate suggestion relevance or visual trust issues.
- Low burst stability can indicate fatigue, density pressure, or typing rhythm interruption.

## Rollback Complexity

Low. Remove the added usage counters and `usageSnapshot()` fields from `KeyboardMetrics`, remove the single `recordTypingTouch()` call from `KeyboardService`, and remove the associated tests/report. No persisted data or external schema exists.

## Release Readiness

Phase 1 is release-safe if validation passes because it is local-only, aggregate-only, bounded, and behavior-neutral.
