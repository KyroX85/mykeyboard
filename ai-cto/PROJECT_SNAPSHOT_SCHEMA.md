# Project Snapshot Schema

## Purpose

The Project Snapshot is the single compact object Jarvis should use for operational questions.

It should be regenerated on demand or before answering project-awareness questions. It is a read-only summary. It does not execute work.

Project snapshots must also obey `REAL_TIME_STATE_SYNC_RULE.md`.

## Evidence-Only Snapshot Policy

Every field in the Project Snapshot must map to a real source.

Allowed source types:

- Git commits
- Git branch state
- Git dirty-tree state
- Build logs
- GitHub Actions runs
- Android APK install evidence
- Android logcat evidence
- app telemetry
- user logs
- explicit user input
- timestamped agent activity logs

If no source exists, the field value must be `null`.

Forbidden:

- `AI inferred status`
- `probable progress`
- `likely completed`
- `assumed blocker`
- emotional interpretation of project state
- roadmap intent presented as reality

Snapshots must represent what is real, not what seems true.

Every snapshot entry must include `evidence_source_id`.

## Real-Time State Sync Rule

Project Awareness updates only when:

- commit happens
- build runs
- CI changes state
- file diff changes

No periodic guessing is allowed.

No background thinking updates are allowed.

If no event occurs, the snapshot must not update.

Every project snapshot must include `last_verified_timestamp`.

If stale, `snapshot_status.value` must be `OUTDATED`.

## Required Fields

```json
{
  "last_verified_timestamp": {
    "value": "2026-06-05T16:30:00.000Z",
    "evidence_source_id": "git_commit_or_build_or_ci_or_diff_event_id"
  },
  "snapshot_status": {
    "value": "CURRENT",
    "evidence_source_id": "freshness_check_against_latest_project_event"
  },
  "generatedAt": {
    "value": "2026-06-05T16:30:00.000Z",
    "evidence_source_id": "snapshot_generation_clock"
  },
  "currentStage": {
    "value": "Jarvis reliability sprint",
    "evidence_source_id": "founder_directive_jarvis_reliability_sprint"
  },
  "currentMilestone": {
    "value": "Reach reliable wake, command capture, Founder Brain answer, and voice output before new capabilities.",
    "evidence_source_id": "founder_directive_current_milestone"
  },
  "lastCompletedWork": [
    {
      "value": "Prevented Vosk partial wake hypotheses from triggering Jarvis.",
      "evidence_source_id": "git_commit_ef2ea2e"
    },
    {
      "value": "Installed latest debug APK on connected phone.",
      "evidence_source_id": "adb_install_log_2026_06_05_213908"
    },
    {
      "value": "Verified focused Jarvis tests and Android debug build locally.",
      "evidence_source_id": "gradle_test_and_assemble_logs_2026_06_05"
    }
  ],
  "activeBlockers": [
    {
      "value": "Need real-device proof that false wakes are no longer accepted wakes.",
      "evidence_source_id": "founder_runtime_report_false_wakes"
    },
    {
      "value": "Jarvis wake service must be enabled again from the app after reinstall.",
      "evidence_source_id": "adb_service_check_after_reinstall"
    },
    {
      "value": "Question understanding accuracy still needs controlled benchmark results.",
      "evidence_source_id": "founder_reliability_benchmark_directive"
    }
  ],
  "nextAction": {
    "value": "Turn on Jarvis Wake Word in the app, then run a short false-wake and normal-wake benchmark.",
    "evidence_source_id": "adb_service_check_after_reinstall"
  },
  "lastCommit": {
    "sha": {
      "value": "ef2ea2e",
      "evidence_source_id": "git_log_latest_commit"
    },
    "message": {
      "value": "fix: prevent partial vosk wake triggers",
      "evidence_source_id": "git_log_latest_commit"
    },
    "pushed": {
      "value": true,
      "evidence_source_id": "git_push_output"
    }
  },
  "lastBuild": {
    "local": {
      "compileDebugKotlin": {
        "value": "passed",
        "evidence_source_id": "gradle_compileDebugKotlin_log"
      },
      "assembleDebug": {
        "value": "passed",
        "evidence_source_id": "gradle_assembleDebug_log"
      },
      "apkInstalledOnDevice": {
        "value": true,
        "evidence_source_id": "adb_install_output"
      },
      "installedVersionName": {
        "value": "1.0.1",
        "evidence_source_id": "adb_dumpsys_package_versionName"
      },
      "installedAt": {
        "value": "2026-06-05 21:39:08",
        "evidence_source_id": "adb_dumpsys_package_lastUpdateTime"
      }
    },
    "githubActions": [
      {
        "workflow": {
          "value": "Android CI",
          "evidence_source_id": "github_actions_api_run"
        },
        "commit": {
          "value": "ef2ea2e",
          "evidence_source_id": "github_actions_api_run"
        },
        "status": {
          "value": "in_progress",
          "evidence_source_id": "github_actions_api_run"
        },
        "conclusion": {
          "value": null,
          "evidence_source_id": null
        }
      },
      {
        "workflow": {
          "value": "Build and Distribute APK",
          "evidence_source_id": "github_actions_api_run"
        },
        "commit": {
          "value": "ef2ea2e",
          "evidence_source_id": "github_actions_api_run"
        },
        "status": {
          "value": "in_progress",
          "evidence_source_id": "github_actions_api_run"
        },
        "conclusion": {
          "value": null,
          "evidence_source_id": null
        }
      }
    ]
  },
  "androidAppState": {
    "packageName": {
      "value": "com.example.mykeyboard",
      "evidence_source_id": "android_manifest_or_adb_package"
    },
    "connectedDevice": {
      "value": "c0ab5eeb",
      "evidence_source_id": "adb_devices_output"
    },
    "jarvisWakeService": {
      "value": null,
      "evidence_source_id": null
    },
    "knownRuntimeFocus": {
      "value": "false wake reduction and speech understanding reliability",
      "evidence_source_id": "founder_reliability_sprint_directive"
    }
  },
  "agentActivity": {
    "latestKnownActivity": {
      "value": "Jarvis reliability fixes and wake false-trigger investigation",
      "evidence_source_id": "git_log_recent_commits"
    },
    "proactiveMessaging": {
      "value": "should remain quiet unless important evidence exists",
      "evidence_source_id": "founder_notification_intelligence_directive"
    }
  },
  "roadmapStage": {
    "phase1Foundation": {
      "value": "protected",
      "evidence_source_id": "founder_phase_transition_directive"
    },
    "phase2Explain": {
      "value": "active conceptually, frozen during Jarvis reliability sprint",
      "evidence_source_id": "founder_phase2_explain_directive"
    },
    "currentFreeze": {
      "value": "no new capabilities until Jarvis reliability improves",
      "evidence_source_id": "founder_reliability_sprint_directive"
    }
  },
  "evidenceGaps": [
    {
      "value": "Remote workflows for latest commit must be rechecked before claiming CI success.",
      "evidence_source_id": "github_actions_status_in_progress"
    },
    {
      "value": "Real-world wake reliability percentage is not proven by source code.",
      "evidence_source_id": "missing_founder_benchmark_report"
    },
    {
      "value": "Command transcript accuracy needs founder-facing benchmark data.",
      "evidence_source_id": "missing_question_understanding_benchmark"
    }
  ]
}
```

## Field Definitions

### `currentStage`

The real operating mode right now. It must be specific.

It must be backed by an explicit founder directive, roadmap file, or current operational report. If none exists, set `value` to `null` and `evidence_source_id` to `null`.

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

It must be backed by explicit founder input, roadmap state, or a current milestone report. Do not infer it from recent work alone.

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

It must come from a real blocker, failed verification, explicit founder directive, or current report. If the next action is only an AI recommendation, keep it outside the snapshot.

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
7. Every non-null field must include `evidence_source_id`.
8. If `evidence_source_id` is missing, the field value must be `null`.
9. Do not store AI-inferred status, probable progress, likely completion, or emotional interpretation as snapshot reality.
10. Update only after commit, build, CI state change, or file diff change.
11. If `last_verified_timestamp` is stale, set `snapshot_status.value` to `OUTDATED`.
12. If `snapshot_status.value` is `OUTDATED`, factual project answers must go through the Hallucination Guard as insufficient data unless fresh evidence is provided.

## Founder-Facing Compression

Jarvis should never read this full object aloud.

Operational voice answers should compress the snapshot into 1-3 sentences.

Example:

```text
Today we tightened Jarvis wake reliability and installed the new APK. The next blocker is real-device verification: we need to prove false wakes are rejected and normal wake still works.
```
