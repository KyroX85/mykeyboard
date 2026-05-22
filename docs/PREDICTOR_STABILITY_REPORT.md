# Predictor Stability Report

## Scope

This pass stabilizes `BasicPredictor` persistence and load behavior without changing prediction philosophy, adding ML, adding network calls, or rewriting predictor architecture.

## Changes Made

- Added persisted model schema marker `schema = 3`.
- Added load-time persisted blob size rejection using the existing `MAX_PERSISTED_MODEL_CHARS` cap.
- Added corruption recovery that clears invalid persisted predictor blobs after load/migration failure.
- Bounded persisted bigram rows to `MAX_MODEL_SIZE`.
- Bounded persisted next-word entries per row to `MAX_ROW_SIZE`.
- Normalized learned/persisted keys during load and legacy migration.
- Snapshot model maps under lock, then build JSON outside the model lock to reduce lock hold time.
- Persist only bounded top entries for unigram, accepted, and rejected maps.

## Memory Impact

- Save path now creates bounded snapshot maps before JSON construction.
- Snapshot size is capped by existing model bounds.
- Runtime predictor maps remain bounded by `trimModelLocked()`.
- No unbounded new collections were introduced.

## Save/Load Complexity

- Save remains debounced through `SAVE_DEBOUNCE_MS`.
- Save still writes one SharedPreferences blob to preserve the current persistence architecture.
- Load now fails closed on oversized/corrupt blobs and keeps session prediction alive through seeded/default model behavior.

## Scaling Behavior

- Max bigram rows: `MAX_MODEL_SIZE`.
- Max row entries: `MAX_ROW_SIZE`.
- Max flat maps: `MAX_MODEL_SIZE`.
- Max persisted blob: `MAX_PERSISTED_MODEL_CHARS`.
- Session maps remain capped by `MAX_SESSION_WORDS` and `MAX_SESSION_PAIR_ROWS`.

## Regression Risk

- Severity: MEDIUM for persistence only.
- Prediction behavior risk: LOW; ranking and candidate generation logic were not changed.
- Persistence compatibility risk: LOW-MEDIUM; legacy arrays still migrate through the existing path with added bounds.

## Rollback Strategy

Revert the `BasicPredictor` persistence snapshot/load-bound changes and remove this report. No schema migration is required because the existing JSON keys remain present.

## Validation Command

```powershell
.\gradlew.bat --no-daemon clean :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

## Confidence Score

8/10. The changes reduce persistence scaling risk while preserving the existing predictor model and tests.
