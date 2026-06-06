# Real-Time State Sync Rule

## Purpose

The Real-Time State Sync Rule prevents awareness snapshots from becoming background guesses.

Project Awareness and Personal Awareness may update only when a real event changes state.

No event means no update.

## Core Rule

```text
If no event occurs, no snapshot update occurs.
```

There is no periodic guessing.
There are no background thinking updates.
There are no imagined state refreshes.

## Project Awareness Update Triggers

Project Awareness may update only when one of these events occurs:

- commit happens
- build runs
- CI changes state
- file diff changes

Allowed examples:

- new git commit
- local dirty tree changes
- GitHub Actions run starts
- GitHub Actions run completes
- Gradle build result changes
- APK install state changes if backed by device evidence

Forbidden examples:

- "it has been a while"
- "agent thinks progress happened"
- "roadmap probably changed"
- "background scan felt stale"

## Personal Awareness Update Triggers

Personal Awareness may update only when one of these events occurs:

- user action occurs
- app usage event occurs
- schedule time passes

Allowed examples:

- founder explicitly enters homework
- founder marks a task complete
- founder-approved app telemetry records aggregate usage
- a founder-approved calendar time passes
- founder logs sleep or study time

Forbidden examples:

- guessing from mood
- guessing from silence
- guessing from project activity
- assuming school work exists
- assuming overload from tone

## Required Snapshot Field

Every awareness snapshot must include:

```json
{
  "last_verified_timestamp": {
    "value": "2026-06-06T00:00:00.000Z",
    "evidence_source_id": "event_id_that_verified_snapshot"
  },
  "snapshot_status": {
    "value": "CURRENT | OUTDATED",
    "evidence_source_id": "freshness_check"
  }
}
```

## Staleness Rule

If the snapshot is stale, the system must mark it:

```text
OUTDATED
```

It must not silently answer as current.

Founder-facing response:

```text
INSUFFICIENT DATA.
The snapshot is OUTDATED because it has not been verified by a new event.
```

## Freshness Rules

Freshness is event-based, not time-based alone.

Time passing can make a snapshot outdated, but it cannot create a new state.

Example:

```text
Schedule time passed -> mark outdated or update only if the schedule event is verified.
```

## Relation To Hallucination Guard

If `snapshot_status` is `OUTDATED`, the Hallucination Guard must treat factual-state confidence as below `70%` unless there is fresh replacement evidence.

That means the output must be:

```text
INSUFFICIENT DATA
```

## Success Criteria

The system stops inventing freshness.

It updates only after real events.

It marks stale snapshots as:

```text
OUTDATED
```

and refuses to pretend it knows current state.
