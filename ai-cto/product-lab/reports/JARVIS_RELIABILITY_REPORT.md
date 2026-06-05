# Jarvis Reliability Report

Generated: 2026-06-05

## Current Scope

Jarvis is frozen for reliability work only.

No new capability work is active:

- No execution layer
- No memory expansion
- No persistent sessions
- No Founder Brain upgrades
- No UI improvements
- No agent improvements

Current milestone:

1. Reliable wake
2. Reliable command capture
3. Reliable Founder Brain answer
4. Reliable voice output

## Current Evidence Source

Evidence comes from founder-provided real-device logcat samples, not simulator assumptions.

The latest useful sample showed:

- Vosk wake model loaded successfully.
- Vosk wake started successfully.
- Wake detected twice.
- Command capture started twice.
- Command captured twice.
- Founder Brain returned voice summaries twice.
- Jarvis returned to idle after speech twice.

## Current Wake Success Rate

Observed from latest log sample:

- Wake engine starts: 3
- Wake detections: 2
- SpeechRecognizer wake fallback starts: 0

Observed wake detections per wake-engine start: 66.7%

Important limitation:

This is not a true 100-attempt wake rate because missed human wake attempts are invisible in logcat unless the founder manually marks every attempt or a test harness emits an attempt marker.

Current truth:

Vosk wake is active and replacing the old fallback path, but real 100-attempt reliability has not been measured yet.

## Current Command Success Rate

Observed from latest log sample:

- Command recognizer starts: 2
- Commands captured: 2
- Command recognizer errors: 0

Observed command capture rate: 100%

Important limitation:

The previous APK only logged transcript character counts, not the actual transcript. Therefore word error rate cannot be computed from that log.

This has now been fixed for debug builds. Future logs will include:

```text
Jarvis command captured: chars=...; transcript="..."
Jarvis command recognition alternatives: ... alternatives=...
```

## Largest Failure Source

Largest visible failure source from latest logs:

Founder Brain network latency / timeout.

Evidence:

```text
SocketTimeoutException: timeout; retry=1
```

The wake path worked. Command capture worked. The user-facing delay came from the brain request exceeding the previous 12-second read timeout.

## Exact Code Changes Made

1. Increased Founder Brain HTTP tolerance:

- Read timeout: 12s -> 28s
- Call timeout: 15s -> 32s
- Retry attempts: 2 -> 1

Reason:

The previous timeout cut off slow Render/Founder Brain responses too early, causing retry delay and making Jarvis feel random.

2. Added debug-only transcript logging:

- Shows actual command transcript in debug APK.
- Shows alternative transcripts and confidence scores.

Reason:

Without transcript visibility, command failures cannot be separated from Founder Brain failures.

3. Suppressed Vosk `[unk]` log noise.

Reason:

Noise made log review harder without improving wake reliability.

4. Added `jarvis-reliability-log-analyzer.js`.

Measures from logcat:

- Wake engine starts
- Fallback wake starts
- Wake detections
- Command starts
- Command captures
- Command errors
- Transcript word error rate when expected phrases are supplied
- Founder Brain timeouts
- Voice completion

## New Measured Success Rate

Not yet available.

The APK must be reinstalled after the latest commit, then the founder should run a small real-world batch:

- 10 wake attempts
- 10 command attempts

Target phrases:

- what am i building
- who am i becoming
- what kills aritenis
- whats our dream
- how is work going

Once the new log is provided, the analyzer can produce transcript-level reliability.

## Estimated Remaining Bottlenecks

1. Command transcript quality

Unknown until the new debug transcript logs are collected.

2. Founder Brain latency

Likely improved by timeout adjustment, but not proven until the next device test.

3. Wake reliability under distance/noise

Vosk is active, but true wake reliability still needs counted attempts.

4. User timing

The user may speak before command capture is ready. Current milestone should verify whether this is still happening before adding any UX signal.

## Next Required Test

Do not build more features.

Reinstall the latest APK and run 10 attempts:

1. Say "Hey Jarvis"
2. Wait for "Yes Sir"
3. Ask one target phrase normally, without shouting
4. Save logcat

Success threshold for this milestone:

At least 7/10 complete correctly:

Wake -> command transcript -> Founder Brain answer -> speech output
