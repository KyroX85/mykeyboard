# Personal Snapshot Schema

## Purpose

The Personal Snapshot is the compact object Jarvis should eventually use for founder-life questions.

It is read-only awareness. It does not execute, schedule, remind, or manage tasks by itself.

Personal snapshots must also obey `REAL_TIME_STATE_SYNC_RULE.md`.

## Evidence-Only Snapshot Policy

Every field in the Personal Snapshot must map to a real source.

Allowed source types:

- explicit user input
- founder-approved user logs
- founder-approved school/task logs
- founder-approved app telemetry
- founder-approved calendar data
- founder-approved sleep or time usage records

If no source exists, the field value must be `null`.

Forbidden:

- `AI inferred status`
- `probable progress`
- `likely completed`
- emotional interpretation of personal state
- inferred overload from tone alone
- guessed school, JEE, Olympiad, badminton, sleep, or family state

Snapshots must represent what is real, not what seems true.

Every snapshot entry must include `evidence_source_id`.

## Real-Time State Sync Rule

Personal Awareness updates only when:

- user action occurs
- app usage event occurs
- schedule time passes

No periodic guessing is allowed.

No background thinking updates are allowed.

If no event occurs, the snapshot must not update.

Every personal snapshot must include `last_verified_timestamp`.

If stale, `snapshot_status.value` must be `OUTDATED`.

## Required Fields

```json
{
  "last_verified_timestamp": {
    "value": null,
    "evidence_source_id": null
  },
  "snapshot_status": {
    "value": "OUTDATED",
    "evidence_source_id": "missing_founder_approved_personal_event"
  },
  "generatedAt": {
    "value": "2026-06-06T00:00:00.000Z",
    "evidence_source_id": "snapshot_generation_clock"
  },
  "dataConfidence": {
    "value": "low",
    "evidence_source_id": "personal_snapshot_evidence_count"
  },
  "currentMode": {
    "value": null,
    "evidence_source_id": null
  },
  "school": {
    "todayTasks": {
      "value": null,
      "evidence_source_id": null
    },
    "homework": {
      "value": null,
      "evidence_source_id": null
    },
    "upcomingTests": {
      "value": null,
      "evidence_source_id": null
    },
    "boardExamPressure": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "jee": {
    "todayTargets": {
      "value": null,
      "evidence_source_id": null
    },
    "weeklyTargets": {
      "value": null,
      "evidence_source_id": null
    },
    "pendingRevision": {
      "value": null,
      "evidence_source_id": null
    },
    "pressure": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "olympiad": {
    "todayTargets": {
      "value": null,
      "evidence_source_id": null
    },
    "upcomingCommitments": {
      "value": null,
      "evidence_source_id": null
    },
    "pressure": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "badminton": {
    "todaySchedule": {
      "value": null,
      "evidence_source_id": null
    },
    "weeklySchedule": {
      "value": null,
      "evidence_source_id": null
    },
    "status": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "family": {
    "pendingResponsibilities": {
      "value": null,
      "evidence_source_id": null
    },
    "timeBlocks": {
      "value": null,
      "evidence_source_id": null
    },
    "status": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "sleep": {
    "lastNightHours": {
      "value": null,
      "evidence_source_id": null
    },
    "sleepDebt": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "timeUsage": {
    "today": {
      "school": {
        "value": null,
        "evidence_source_id": null
      },
      "study": {
        "value": null,
        "evidence_source_id": null
      },
      "aritenis": {
        "value": null,
        "evidence_source_id": null
      },
      "badminton": {
        "value": null,
        "evidence_source_id": null
      },
      "family": {
        "value": null,
        "evidence_source_id": null
      },
      "rest": {
        "value": null,
        "evidence_source_id": null
      }
    }
  },
  "personalGoals": {
    "active": [
      {
        "value": "protect school responsibilities",
        "evidence_source_id": "founder_context_school_constraints"
      },
      {
        "value": "prepare for board exams, JEE, and Olympiad",
        "evidence_source_id": "founder_context_exam_pressure"
      },
      {
        "value": "keep Aritenis moving without destroying normal life",
        "evidence_source_id": "founder_context_life_load"
      }
    ],
    "deferred": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "pendingCommitments": {
    "value": null,
    "evidence_source_id": null
  },
  "overloadSignals": {
    "knownSignals": {
      "value": null,
      "evidence_source_id": null
    },
    "unknownSignals": [
      {
        "value": "exact homework load",
        "evidence_source_id": "missing_founder_approved_school_log"
      },
      {
        "value": "today's study progress",
        "evidence_source_id": "missing_founder_approved_study_log"
      },
      {
        "value": "sleep",
        "evidence_source_id": "missing_founder_approved_sleep_log"
      },
      {
        "value": "family responsibilities",
        "evidence_source_id": "missing_founder_approved_family_log"
      },
      {
        "value": "badminton timing",
        "evidence_source_id": "missing_founder_approved_badminton_log"
      }
    ],
    "overloadLevel": {
      "value": null,
      "evidence_source_id": null
    }
  },
  "recommendedFocus": {
    "now": {
      "value": null,
      "evidence_source_id": null
    },
    "reason": {
      "value": "Personal schedule data is not available yet.",
      "evidence_source_id": "missing_personal_snapshot_sources"
    }
  },
  "evidenceGaps": [
    {
      "value": "No founder-approved daily school task list loaded.",
      "evidence_source_id": "missing_founder_approved_school_log"
    },
    {
      "value": "No founder-approved study schedule loaded.",
      "evidence_source_id": "missing_founder_approved_study_log"
    },
    {
      "value": "No founder-approved sleep or time usage data loaded.",
      "evidence_source_id": "missing_founder_approved_sleep_log"
    },
    {
      "value": "No badminton or family schedule loaded.",
      "evidence_source_id": "missing_founder_approved_life_schedule"
    }
  ]
}
```

## Field Definitions

### `dataConfidence`

How much personal reality Jarvis can actually see.

Allowed values:

- `high`
- `medium`
- `low`
- `unknown`

Default should be `low` or `unknown` until explicit founder-approved data exists.

If no founder-approved personal source exists, use `unknown`.

### `currentMode`

The founder's practical life mode.

Examples:

- `school_day`
- `exam_week`
- `weekend`
- `badminton_day`
- `aritenis_focus_window`
- `recovery_day`
- `unknown`

Do not infer this without evidence.

If there is no source, set `value` to `null` and `evidence_source_id` to `null`.

### `school`

Contains school-specific obligations.

Allowed:

- homework
- tests
- board exam pressure
- school deadlines

Not allowed:

- private school chat contents
- teacher messages unless founder provides them
- personal classmate data

### `jee`

Contains JEE workload, targets, and pending revision.

Use explicit targets only.

### `olympiad`

Contains Olympiad preparation and commitments.

Use explicit targets only.

### `badminton`

Contains practice or match schedule if founder provides it.

Do not guess training load.

### `family`

Contains commitments only if founder provides them.

Family data should be minimal and privacy-safe.

### `sleep`

Sleep should be founder-approved and simple.

Do not create medical claims.

### `timeUsage`

Use only aggregate categories.

Forbidden:

- raw app content
- private messages
- exact browsing history
- surveillance-style tracking

### `overloadSignals`

Only evidence-backed signals.

Examples:

- multiple exams in the same week
- less sleep explicitly logged
- unfinished commitments
- founder says he is overloaded

Do not invent overload from tone alone.

### `recommendedFocus`

One practical focus recommendation.

If data is missing, say unknown.

## Snapshot Generation Rules

1. Use founder-approved personal data only.
2. Prefer explicit tasks over inferred pressure.
3. Do not collect private personal data silently.
4. Do not output scores without calculation.
5. Unknown is better than fake certainty.
6. Personal Awareness should never override urgent safety or health needs.
7. Project work should not automatically outrank school or exam responsibilities.
8. Every non-null field must include `evidence_source_id`.
9. If `evidence_source_id` is missing, the field value must be `null`.
10. Do not store AI-inferred status, probable progress, likely completion, or emotional interpretation as snapshot reality.
11. Update only after user action, founder-approved app usage event, or founder-approved schedule time passing.
12. If `last_verified_timestamp` is stale or missing, set `snapshot_status.value` to `OUTDATED`.
13. If `snapshot_status.value` is `OUTDATED`, factual personal answers must go through the Hallucination Guard as insufficient data unless fresh evidence is provided.

## Founder-Facing Compression

Jarvis should compress the snapshot into short human answers.

No-data example:

```text
I don't have today's school or study tasks loaded. From known context, protect school first, then work on Jarvis only if there is a clear time window.
```

Data-backed example:

```text
You still have homework and one JEE block left. Finish those first. Aritenis should stay light today.
```

## Privacy Standard

The Personal Snapshot is more sensitive than the Project Snapshot.

Every future implementation must answer:

- What personal data is stored?
- Who provided it?
- How long is it kept?
- Can the founder delete it?
- Is any raw personal text stored?
- Can any personal data leave the device?

Until those answers are implemented, this remains a design contract only.
