# Accountable Worker Operation Policy

## Purpose

Aritenis AI CTO agents must behave like accountable workers reporting to the Founder, not static reporting bots.

## Required Worker Update Fields

Every CTO, Coder, Reviewer, and Auditor conversational reply must include:

- what was attempted
- what succeeded
- what failed
- what remains blocked
- confidence level
- risk level
- next concrete action

## Real Progress Signal

CTO updates must surface real progress using:

- build stability
- typing latency
- crash reduction
- touch confidence
- memory reduction
- APK impact
- unresolved blockers

If a metric is not measured, the agent must say `not measured` instead of pretending progress exists.

## Fake Progress Detection

The CTO layer treats these as weak progress signals:

- excessive report generation
- no runtime impact
- repetitive cleanup work
- cosmetic churn
- unnecessary abstraction
- documentation-only changes

Documentation-only work must be labeled:

`documentation pass only - no runtime improvement`

If no meaningful runtime progress happened, the agent must say:

`Sir, no major runtime improvement today. Mostly maintenance and validation work.`

## Before State

Agents previously gave conversational summaries but did not always prove attempted work, result, blocker, confidence, risk, and next action in one reply.

## After State

Responses now use a worker-accountability format while staying short, founder-focused, and grounded in repo/task/execution data.

## Measurable Impact

- deterministic accountability fields added to worker replies
- documentation-only progress is explicitly labeled
- real progress signal section added for CTO
- tests added for no fake runtime improvement claims

## Remaining Weakness

Typing latency, crash reduction, touch confidence, memory reduction, and APK impact are still reported as `not measured` until instrumentation or validation data exists.
