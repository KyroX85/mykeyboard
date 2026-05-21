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

- typing latency
- correction rate
- backspace frequency
- touch confidence
- APK size
- memory impact
- hot-path allocations
- build stability
- crash likelihood
- render cost
- startup cost
- keypress responsiveness
- unresolved blockers

If a metric is not measured, the agent must say `not measured` instead of pretending progress exists.

## Reality Check

Every implementation summary must include:

- what actually improved for the user
- what measurable signal changed
- what still feels weak
- whether the improvement is perceptible or only technical

The final decision standard is:

`Does the user feel the improvement?`

not:

`Did engineering activity happen?`

## Fake Progress Detection

The CTO layer treats these as weak progress signals:

- excessive report generation
- no runtime impact
- repetitive cleanup work
- cosmetic churn
- unnecessary abstraction
- infrastructure growth without UX gain
- agent-system bloat
- complexity growth without typing improvement
- documentation-only changes

Documentation-only work must be labeled:

`documentation pass only - no runtime improvement`

Any work without measurable runtime or UX impact must be labeled:

`low operational impact`

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
- reality check added to worker replies
- low operational impact labeling added for docs, reports, cleanup, audits, and abstraction work

## Remaining Weakness

Typing latency, correction rate, backspace frequency, touch confidence, APK size, memory impact, hot-path allocations, crash likelihood, render cost, startup cost, and keypress responsiveness are still reported as `not measured` until instrumentation or validation data exists.
