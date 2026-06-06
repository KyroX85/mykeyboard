# Hallucination Guard Layer

## Purpose

The Hallucination Guard Layer is the system-wide guard above all agents.

It prevents Project Awareness, Personal Awareness, and Founder Brain outputs from filling missing reality with generic intelligence, personality, or philosophy.

This is not execution.
This is not reasoning.
This is not a new agent.

It is an output safety gate.

## Core Rule

If system confidence is below `70%`, the response must say:

```text
INSUFFICIENT DATA
```

The system may then briefly state what evidence is missing, but it must not answer as if it knows.

## Runtime Position

```text
Founder/Jarvis input
-> Unified Truth Router
-> Project Awareness / Personal Awareness / Founder Brain
-> Reality Awareness validation
-> Hallucination Guard Layer
-> founder-facing response
```

The Hallucination Guard Layer sits above all agents and below final response delivery.

It receives `truth_status` and `safe_response_mode` from `UNIFIED_TRUTH_ROUTER.md`. If `truth_status` is `UNKNOWN`, factual-state answers must become `INSUFFICIENT DATA`.

## Applies To

This guard applies to:

- Project Awareness
- Personal Awareness
- Founder Brain factual claims
- WhatsApp agents
- Jarvis voice summaries
- future OS/runtime surfaces

## What It Blocks

The guard blocks:

- generic intelligence replacing missing data
- personality answers when factual data is missing
- philosophical replies when asked factual state
- roadmap-flavored filler
- founder-memory filler
- motivational replies
- invented health, momentum, overload, productivity, reliability, or progress scores
- "probably", "likely", or "seems" presented as reality

## Confidence Rule

System confidence is based on verifiable evidence, not answer fluency.

```text
>= 70%: may answer with evidence.
< 70%: must return INSUFFICIENT DATA.
```

Confidence must come from the Reality Awareness Layer:

- evidence list
- unknown gaps
- blocked claims
- allowed claims
- reality confidence score

If Reality Awareness did not run, confidence is treated as `0%`.

## Required Output When Data Is Missing

For factual-state questions:

```text
INSUFFICIENT DATA.
I do not have [missing evidence].
```

Examples:

```text
INSUFFICIENT DATA.
I do not have today's school task list, study log, sleep record, or badminton schedule.
```

```text
INSUFFICIENT DATA.
I do not have the latest GitHub Actions conclusion or a fresh device log.
```

## Factual State Questions

The guard is strict for questions like:

- What happened today?
- What is blocked?
- What changed?
- What is pending?
- How is the app doing?
- How overloaded am I?
- Did I finish everything?
- How much work is left?
- Is Jarvis reliable?
- Did the build pass?

These must be evidence-based only.

## Reflection Questions

Founder Brain may answer reflective questions without project or personal-state evidence.

Examples:

- Why am I building Jarvis?
- What am I avoiding?
- Who am I becoming?
- What contradiction do you see?

But if the answer includes factual claims like "you slept badly" or "the build passed", those claims must pass the guard.

## Forbidden Replacements

When data is missing, do not replace reality with:

```text
Based on your vision...
As a founder...
Given your current momentum...
You are probably...
The project seems...
Your life appears...
```

Use:

```text
INSUFFICIENT DATA
```

## Examples

### Project Question

Question:

```text
How is the Android app doing?
```

If latest build/device evidence is missing:

```text
INSUFFICIENT DATA.
I do not have a fresh Android CI result, APK install check, or device runtime log.
```

### Personal Question

Question:

```text
How overloaded am I this week?
```

If personal workload data is missing:

```text
INSUFFICIENT DATA.
I do not have your school tasks, study workload, sleep, badminton schedule, or family commitments for this week.
```

### Reflection Question

Question:

```text
Why am I building Jarvis?
```

Allowed:

```text
You are building Jarvis because you want humans to choose direction while machinery carries the burden of execution.
```

Not allowed:

```text
You are building Jarvis because you are overloaded this week.
```

unless overload evidence exists.

## Final Response Policy

Replace:

```text
AI answer style
```

with:

```text
evidence-based response only
```

For factual-state questions, clarity beats warmth.

For missing data, truth beats usefulness.

## Success Criteria

The system no longer pretends.

If it lacks evidence, it says:

```text
INSUFFICIENT DATA
```

That answer is better than a confident hallucination.
