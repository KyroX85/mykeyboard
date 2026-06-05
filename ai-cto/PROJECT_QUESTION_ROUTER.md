# Project Question Router

## Purpose

The Project Question Router decides whether a founder question needs operational reality or founder reasoning.

It must run before Founder Brain for project-status questions.

## Core Rule

If the founder is asking what happened, what changed, what is blocked, what is next, or how the app/work is doing, route to Project Awareness first.

If the founder is asking why, meaning, dream, identity, fear, contradiction, or strategic doubt, route to Founder Brain first.

## Route Table

| Founder question pattern | Route | Reason |
| --- | --- | --- |
| What happened today? | Project Awareness | Needs recent commits, builds, and completed work. |
| What changed since yesterday? | Project Awareness | Needs git and activity diff. |
| What is blocked? | Project Awareness | Needs build/runtime/task blockers. |
| What is next? | Project Awareness | Needs current milestone and next action. |
| What are we doing? | Project Awareness | Needs current stage and active work. |
| How is work going? | Project Awareness | Needs operational state, not founder philosophy. |
| How is the Android app doing? | Project Awareness | Needs APK/build/device/runtime state. |
| Did the build pass? | Project Awareness | Needs GitHub Actions/local Gradle state. |
| What did agents do? | Project Awareness | Needs agent activity log and commits. |
| Are we moving toward the dream? | Founder Brain | Strategic alignment question. |
| What am I avoiding? | Founder Brain | Founder reflection question. |
| What belief changed? | Founder Brain | Founder identity/evolution question. |
| What kills us? | Founder Brain, optionally with Project Awareness evidence | Strategic premortem, not a status report. |
| Build this / fix this / implement this | Execution Router | Explicit execution request. |

## Classification Priority

Use this order:

1. Explicit execution request
2. Project operational question
3. Founder reflection/strategy question
4. Product discussion
5. Clarify only if still unclear

Execution request requires explicit verbs like:

- implement
- fix
- build
- commit
- modify
- run
- install
- generate

Normal operational questions do not trigger execution.

## Examples

### Question

```text
What happened today?
```

### Good Answer

```text
Today we tightened Jarvis wake reliability. Vosk partial wake results can no longer trigger Jarvis, and the latest APK was installed on your phone. The next check is real-device testing: normal wake should still work, and background audio should not trigger accepted wakes.
```

### Bad Answer

```text
You are chasing freedom and agency.
```

That answer may be philosophically true, but it does not answer the operational question.

## Project Awareness Answer Style

Keep responses:

- concrete
- short
- evidence-based
- founder-facing
- free of internal labels

Do not show:

- route confidence
- memory sources
- diagnostics
- health score
- momentum score
- internal framework names

Unless asked for debugging, never say:

```text
Project Awareness route selected.
```

Just answer.

## Staleness Rules

If project evidence is stale, say it naturally:

```text
The last verified remote build I can see is from the previous commit. The latest commit is pushed, but its workflows still need a fresh check.
```

Do not pretend stale evidence is current.

## Mixed Questions

Some questions need both systems.

Example:

```text
Are we actually moving forward today?
```

Use Project Awareness first for today's evidence, then Founder Brain style for meaning.

Good:

```text
Yes, but narrowly. Today moved Jarvis reliability forward, not the whole company vision. That is still the right kind of progress because Jarvis cannot become useful until wake and speech stop feeling random.
```

## Forbidden Outputs For Project Questions

Project questions must not return:

- founder identity essays
- route diagnostics
- generic CTO status banners
- fake health/momentum scores
- task plans unless explicitly requested
- approval tokens unless execution was explicitly requested

## Success Criteria

The founder can ask:

```text
What happened today?
What is blocked?
What is next?
How is the Android app doing?
```

and receive answers grounded in real project state instead of generic founder philosophy.
