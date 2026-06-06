# Unified Truth Router

## Purpose

The Unified Truth Router decides what is real before any agent, Jarvis surface, or Founder Brain response reaches the founder.

It is the top-level routing contract for factual awareness.

It does not execute.
It does not generate intelligence.
It does not replace Founder Brain.
It decides whether a response may safely answer, must stay partial, or must stop.

## Routing Order

Every founder-facing answer must pass through this order:

```text
1. Reality Awareness Layer
2. Project Awareness or Personal Awareness
3. Founder Brain reasoning
4. Response generation
```

This order is mandatory.

Founder Brain may reason only after factual reality has been checked.

## Core Rules

### Rule 1: Reality First

Run `REALITY_AWARENESS_LAYER.md` before Project Awareness, Personal Awareness, Founder Brain factual claims, or response generation.

If Reality Awareness fails, stop.

Do not answer from memory, style, personality, roadmap, or philosophy.

### Rule 2: Outdated Snapshot Stops Factual Answers

If a project or personal snapshot is marked:

```text
OUTDATED
```

or lacks:

```text
last_verified_timestamp
```

then the router must request an update instead of answering factual state.

### Rule 3: Evidence Beats Reasoning

If sources conflict, choose verifiable evidence over Founder Brain reasoning.

Examples:

- GitHub Actions failure beats "the project is healthy."
- Missing school-task data beats "you are probably overloaded."
- Device log failure beats "Jarvis should be working."

### Rule 4: No Direct Founder Brain For Factual State

Questions about current project or personal state must not route directly to Founder Brain.

Examples:

- What happened today?
- What is blocked?
- How is the Android app doing?
- How overloaded am I?
- Did I finish everything?

These require awareness evidence first.

### Rule 5: Reflection Can Use Founder Brain

Reflection, vision, identity, and strategy questions may route to Founder Brain after the router confirms the answer is not claiming unverified current state.

Examples:

- Why am I building Jarvis?
- Who am I becoming?
- What contradiction do you see?
- What kills Aritenis strategically?

If the answer mentions current builds, schedules, workload, reliability, or completed work, those claims must pass Reality Awareness.

## Required Router Output

Every route decision must produce:

```json
{
  "truth_status": "VERIFIED | PARTIAL | UNKNOWN",
  "sources_used": [],
  "missing_data": [],
  "safe_response_mode": "ANSWER | PARTIAL_WITH_LIMITS | REQUEST_UPDATE | INSUFFICIENT_DATA | REFLECTION_ONLY"
}
```

## Field Definitions

### `truth_status`

- `VERIFIED`: current evidence is strong enough to answer.
- `PARTIAL`: some evidence exists, but important gaps remain.
- `UNKNOWN`: evidence is missing, stale, conflicting, or below the confidence threshold.

### `sources_used`

Concrete sources used to permit claims.

Examples:

```json
[
  "git log latest commit",
  "GitHub Actions latest Android CI run",
  "explicit founder-provided school task list"
]
```

### `missing_data`

Evidence needed before a stronger answer is allowed.

Examples:

```json
[
  "latest Android CI conclusion",
  "device log after current APK install",
  "today's school task list"
]
```

### `safe_response_mode`

- `ANSWER`: answer directly from verified evidence.
- `PARTIAL_WITH_LIMITS`: answer only supported claims and name important gaps.
- `REQUEST_UPDATE`: ask for a fresh snapshot or event because known data is outdated.
- `INSUFFICIENT_DATA`: do not answer the factual question.
- `REFLECTION_ONLY`: answer founder reflection without factual-state claims.

## Safe Response Behavior

The founder should not normally see the routing object.

The founder should see the safest compressed answer.

### `ANSWER`

Use when evidence is current and confidence is at least `70%`.

```text
The latest Android CI passed for the current commit. The APK state is still unknown because I do not have a device install check.
```

### `PARTIAL_WITH_LIMITS`

Use when some claims are supported, but not all.

```text
I can verify the latest commit, but I cannot verify whether the APK on your phone matches it.
```

### `REQUEST_UPDATE`

Use when a snapshot is stale.

```text
I need a fresh project snapshot before answering that. The current snapshot is outdated.
```

### `INSUFFICIENT_DATA`

Use when the system lacks evidence.

```text
INSUFFICIENT DATA.
I do not have today's school tasks, study workload, sleep, or badminton schedule.
```

### `REFLECTION_ONLY`

Use for founder reflection where factual state is not required.

```text
You are building Jarvis because you want humans to choose direction while machinery carries the burden of execution.
```

## Conflict Resolution

When evidence and reasoning disagree:

```text
Evidence wins.
```

Examples:

| Conflict | Winning Source |
| --- | --- |
| Founder Brain says project is moving well, but CI failed | CI failure |
| Memory says Phase 2 is active, but no implementation evidence exists | Evidence-backed partial answer |
| Agent says work completed, but no commit/log exists | Unknown |
| Founder feels overloaded, but no schedule data exists | Reflection allowed; factual overload unknown |

## Domain Routing

### Project Awareness First

Route to Project Awareness when the founder asks about:

- repo changes
- commits
- builds
- CI
- APK state
- Android app state
- current milestone
- blockers
- agent work

### Personal Awareness First

Route to Personal Awareness when the founder asks about:

- school work
- JEE or board pressure
- Olympiad tasks
- badminton schedule
- sleep or fatigue logs
- family commitments
- daily workload
- personal pending work

### Founder Brain First After Truth Check

Route to Founder Brain for:

- identity
- motivation
- dream
- strategy
- fear
- contradiction
- founder evolution

Founder Brain must not override `truth_status`.

## Examples

### Question

```text
How is the Android app doing?
```

If latest build and device logs are missing:

```json
{
  "truth_status": "UNKNOWN",
  "sources_used": [],
  "missing_data": ["latest Android CI result", "current APK install state", "device runtime log"],
  "safe_response_mode": "INSUFFICIENT_DATA"
}
```

Founder-facing answer:

```text
INSUFFICIENT DATA.
I do not have a fresh Android CI result, current APK install check, or device runtime log.
```

### Question

```text
What happened today?
```

If git is current but GitHub Actions is not checked:

```json
{
  "truth_status": "PARTIAL",
  "sources_used": ["git log latest commit"],
  "missing_data": ["latest GitHub Actions conclusion"],
  "safe_response_mode": "PARTIAL_WITH_LIMITS"
}
```

Founder-facing answer:

```text
I can verify the latest local commit, but I cannot honestly claim the remote build result until GitHub Actions is checked.
```

### Question

```text
Why am I building Jarvis?
```

```json
{
  "truth_status": "PARTIAL",
  "sources_used": ["founder vision memory"],
  "missing_data": [],
  "safe_response_mode": "REFLECTION_ONLY"
}
```

Founder-facing answer:

```text
You are building Jarvis because you want humans to stay free while machines carry the burden of execution.
```

## Integration Contract

All founder-facing systems must treat this router as the first authority:

```text
Founder/Jarvis input
-> Unified Truth Router
-> Reality Awareness Layer
-> Project or Personal Awareness when factual
-> Founder Brain when reflective or strategic
-> Hallucination Guard
-> response generation
```

No agent should respond before this route is decided.

## Success Criteria

Jarvis stops hallucinating state.

It no longer answers:

```text
The project is healthy.
You are overloaded.
Momentum is stalled.
Jarvis is reliable.
The APK is current.
```

unless evidence proves it.

When evidence is missing, the correct answer is:

```text
INSUFFICIENT DATA
```

That is not weakness.
That is trust.
