# JARVIS FALSE WAKE REPORT

## Current Status

False-wake measurement is now instrumented.

This report must not claim a false-wake percentage until the latest APK is installed and tested in real audio environments.

## What Is Now Measured

Every Vosk wake candidate now logs:

- `REAL_WAKE` or `FALSE_WAKE`
- wake phrase
- confidence
- wake source
- audio source if detectable
- rejection / acceptance reason

Porcupine detections now log:

- `REAL_WAKE`
- phrase
- source
- confidence status

## Wake Acceptance Rule

Accepted:

- complete `hey jarvis` phrase

Rejected:

- single-word `jarvis`
- partial wake candidates
- phonetic approximations such as `javis`, `jarves`, or `javed`
- incomplete phrases such as `he jarvis` or `a jarvis`
- noisy fragments from music / TV / background speech

## Benchmark Required

Run the same wake phrase test in:

1. Quiet room
2. Music playing
3. TV dialogue
4. YouTube speech
5. Crowded room

Target:

- False wake rate below 5%
- Real wake reliability above 80%

## How To Generate The Report

Capture logcat after installing the latest APK, then run:

```bash
node ai-cto/product-lab/jarvis-reliability-log-analyzer.js logcat.txt --founder-success
```

Read:

- `falseWakeReport.realWakeRate`
- `falseWakeReport.falseWakeRate`
- `falseWakeReport.confidenceHistogram`
- `falseWakeReport.topFalseTriggerPhrases`
- `falseWakeReport.mostCommonWakeReasons`

## Current Real Wake %

Pending latest APK benchmark.

## Current False Wake %

Pending latest APK benchmark.

## Confidence Histogram

Pending latest APK benchmark.

## Top False Trigger Phrases

Pending latest APK benchmark.

## Recommended Fix

No further fix should be selected until the latest APK produces false-wake logs from real music, TV, YouTube, and crowded-room tests.
