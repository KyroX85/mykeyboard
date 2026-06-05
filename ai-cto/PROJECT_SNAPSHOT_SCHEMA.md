# Project Snapshot Schema

## Purpose

The Project Snapshot is the single compact object Jarvis should use for operational questions.

It should be regenerated on demand or before answering project-awareness questions. It is a read-only summary. It does not execute work.

## Required Fields

```json
{
  "generatedAt": "2026-06-05T16:30:00.000Z",
  "currentStage": "Jarvis reliability sprint",
  "currentMilestone": "Reach reliable wake, command capture, Founder Brain answer, and voice output before new capabilities.",
  "lastCompletedWork": [
    "Prevented Vosk partial wake hypotheses from triggering Jarvis.",
    "Installed latest debug APK on connected phone.",
    "Verified focused Jarvis tests and Android debug build locally."
  ],
  "activeBlockers": [
    "Need real-device proof that false wakes are no longer accepted wakes.",
    "Jarvis wake service must be enabled again from the app after reinstall.",
    "Question understanding accuracy still needs controlled benchmark results."
  ],
  "nextAction": "Turn on Jarvis Wake Word in the app, then run a short false-wake and normal-wake benchmark.",
  "lastCommit": {
    "sha": "ef2ea2e",
    "message": "fix: prevent partial vosk wake triggers",
    "pushed": true
  },
  "lastBuild": {
    "local": {
      "compileDebugKotlin": "passed",
      "assembleDebug": "passed",
      "apkInstalledOnDevice": true,
      "installedVersionName": "1.0.1",
      "installedAt": "2026-06-05 21:39:08"
    },
    "githubActions": [
      {
        "workflow": "Android CI",
        "commit": "ef2ea2e",
        "status": "in_progress",
        "conclusion": null
      },
      {
        "workflow": "Build and Distribute APK",
        "commit": "ef2ea2e",
        "status": "in_progress",
        "conclusion": null
      }
    ]
  },
  "androidAppState": {
    "packageName": "com.example.mykeyboard",
    "connectedDevice": "c0ab5eeb",
    "jarvisWakeService": "must be verified after user enables it in app",
    "knownRuntimeFocus": "false wake reduction and speech understanding reliability"
  },
  "agentActivity": {
    "latestKnownActivity": "Jarvis reliability fixes and wake false-trigger investigation",
    "proactiveMessaging": "should remain quiet unless important evidence exists"
  },
  "roadmapStage": {
    "phase1Foundation": "protected",
    "phase2Explain": "active conceptually, frozen during Jarvis reliability sprint",
    "currentFreeze": "no new capabilities until Jarvis reliability improves"
  },
  "evidenceGaps": [
    "Remote workflows for latest commit must be rechecked before claiming CI success.",
    "Real-world wake reliability percentage is not proven by source code.",
    "Command transcript accuracy needs founder-facing benchmark data."
  ]
}
```

## Field Definitions

### `currentStage`

The real operating mode right now. It must be specific.

Examples:

- `Jarvis reliability sprint`
- `Phase 2 Explain design`
- `Product Lab verification`
- `Preservation mode`

Do not use stale broad labels like `Phase 1 Stabilization` if the founder has moved the operating mode forward.

### `currentMilestone`

The concrete milestone the system is trying to reach next.

It should answer:

```text
What are we trying to prove or finish before moving on?
```

### `lastCompletedWork`

Only include work with evidence:

- commit
- test pass
- build pass
- installed APK
- report generated
- verified run

Do not include philosophical progress as completed engineering work.

### `activeBlockers`

Only include real blockers:

- failed build
- failed workflow
- missing key
- runtime not verified
- real-device failure
- pending founder decision

Do not include generic complexity warnings unless they are currently blocking the milestone.

### `nextAction`

One next action only.

It should be the smallest action that increases project certainty.

### `lastBuild`

Separate local and remote build state.

Do not claim remote success from local build success.

### `evidenceGaps`

Use this when the system does not know something.

This is better than fake certainty.

## Snapshot Generation Rules

1. Prefer fresh evidence over memory.
2. Prefer local git and GitHub Actions over narrative summaries.
3. Prefer device/runtime verification over source-code assumptions.
4. If evidence is stale, label it stale.
5. If a value is unknown, say unknown.
6. Never synthesize health or momentum unless provenance exists.

## Founder-Facing Compression

Jarvis should never read this full object aloud.

Operational voice answers should compress the snapshot into 1-3 sentences.

Example:

```text
Today we tightened Jarvis wake reliability and installed the new APK. The next blocker is real-device verification: we need to prove false wakes are rejected and normal wake still works.
```
