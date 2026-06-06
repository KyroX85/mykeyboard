# Personal Snapshot Schema

## Purpose

The Personal Snapshot is the compact object Jarvis should eventually use for founder-life questions.

It is read-only awareness. It does not execute, schedule, remind, or manage tasks by itself.

## Required Fields

```json
{
  "generatedAt": "2026-06-06T00:00:00.000Z",
  "dataConfidence": "low",
  "currentMode": "unknown",
  "school": {
    "todayTasks": [],
    "homework": [],
    "upcomingTests": [],
    "boardExamPressure": "known_context_only"
  },
  "jee": {
    "todayTargets": [],
    "weeklyTargets": [],
    "pendingRevision": [],
    "pressure": "unknown"
  },
  "olympiad": {
    "todayTargets": [],
    "upcomingCommitments": [],
    "pressure": "unknown"
  },
  "badminton": {
    "todaySchedule": null,
    "weeklySchedule": [],
    "status": "unknown"
  },
  "family": {
    "pendingResponsibilities": [],
    "timeBlocks": [],
    "status": "unknown"
  },
  "sleep": {
    "lastNightHours": null,
    "sleepDebt": "unknown",
    "source": "not_loaded"
  },
  "timeUsage": {
    "today": {
      "school": null,
      "study": null,
      "aritenis": null,
      "badminton": null,
      "family": null,
      "rest": null
    },
    "source": "not_loaded"
  },
  "personalGoals": {
    "active": [
      "protect school responsibilities",
      "prepare for board exams, JEE, and Olympiad",
      "keep Aritenis moving without destroying normal life"
    ],
    "deferred": []
  },
  "pendingCommitments": [],
  "overloadSignals": {
    "knownSignals": [],
    "unknownSignals": [
      "exact homework load",
      "today's study progress",
      "sleep",
      "family responsibilities",
      "badminton timing"
    ],
    "overloadLevel": "unknown"
  },
  "recommendedFocus": {
    "now": "unknown until today's personal tasks are loaded",
    "reason": "Personal schedule data is not available yet."
  },
  "evidenceGaps": [
    "No founder-approved daily school task list loaded.",
    "No founder-approved study schedule loaded.",
    "No founder-approved sleep or time usage data loaded.",
    "No badminton or family schedule loaded."
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
