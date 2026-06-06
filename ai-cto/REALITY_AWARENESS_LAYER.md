# Reality Awareness Layer

## Purpose

The Reality Awareness Layer is the truth filter for Jarvis.

It sits between agent output, awareness systems, and Founder Brain so the system does not pretend it knows what is happening.

It does not create intelligence.
It does not create state.
It does not execute.
It validates claims against evidence.

## Core Rule

Only verifiable signals may become awareness.

If no verifiable data exists, the layer must return:

```text
UNKNOWN STATE
```

## Position In The Runtime

```text
Agent output
-> Reality Awareness Layer
-> Project Awareness or Personal Awareness
-> Founder Brain only when reflection/strategy is needed
-> founder-facing response
```

The Reality Awareness Layer must run before any awareness answer is trusted.

## What Counts As Evidence

### Project Evidence

Allowed:

- git commits
- git branch state
- git dirty tree state
- GitHub Actions status
- local Gradle/test results
- APK build artifact state
- connected-device install state
- Android logcat evidence
- agent action logs
- explicit founder messages
- existing reports with timestamps

Not enough by itself:

- agent confidence
- roadmap intention
- old memory
- stale reports
- philosophical reasoning
- "probably"

### Personal Evidence

Allowed only when founder-provided or founder-approved:

- explicit school tasks
- explicit homework list
- explicit test dates
- explicit study targets
- explicit badminton schedule
- explicit family commitments
- explicit sleep/time logs
- explicit founder statements like "I am overloaded today"

Not allowed:

- guessing from tone
- inferring private life from repo activity
- reading private chats without approval
- app usage surveillance
- silent location or microphone-derived lifestyle inference
- invented personal productivity scores

## Required Output

Every validation result must include:

```json
{
  "state": "KNOWN | PARTIAL | UNKNOWN STATE",
  "realityConfidence": 0.0,
  "evidence": [],
  "unknownGaps": [],
  "blockedClaims": [],
  "allowedClaims": []
}
```

## Field Definitions

### `state`

- `KNOWN`: enough current evidence exists to answer directly.
- `PARTIAL`: some evidence exists, but important gaps remain.
- `UNKNOWN STATE`: evidence is missing or stale.

### `realityConfidence`

Score from `0.0` to `1.0`.

Guideline:

- `0.90-1.00`: direct current evidence from reliable sources.
- `0.70-0.89`: strong evidence but one meaningful gap.
- `0.40-0.69`: partial evidence; answer must include uncertainty.
- `0.10-0.39`: weak evidence; answer should mostly say unknown.
- `0.00`: no evidence.

This is not answer confidence. It is evidence confidence.

### `evidence`

List concrete sources used.

Examples:

```json
[
  "git log: 4f95938 docs: define personal awareness layer",
  "GitHub Actions: Android CI in_progress for 4f95938",
  "Founder statement: school/JEE/Olympiad pressure exists"
]
```

### `unknownGaps`

List what is missing.

Examples:

```json
[
  "today's homework list not loaded",
  "latest GitHub Actions conclusion not checked",
  "Jarvis wake service runtime state not verified after reinstall"
]
```

### `blockedClaims`

Claims the agent wanted to make but cannot prove.

Examples:

```json
[
  "Founder is overloaded this week",
  "Android app is healthy",
  "Jarvis reliability is above 70%"
]
```

### `allowedClaims`

Claims that are supported by evidence.

Examples:

```json
[
  "Personal Awareness design docs were added",
  "Latest pushed commit is 4f95938",
  "Personal daily schedule is not loaded"
]
```

## Claim Validation Rules

### Rule 1: No Evidence Means Unknown

If a claim has no evidence:

```text
UNKNOWN STATE
```

Do not soften it into "probably."

### Rule 2: Stale Evidence Must Be Marked

If evidence exists but is old, the answer must say it is stale.

Example:

```text
The last verified build I can see was from yesterday. I do not know the current build state.
```

### Rule 3: Memory Is Context, Not Proof

Founder memory can explain why something matters.

It cannot prove what happened today.

### Rule 4: Personal State Requires Explicit Data

Personal Awareness cannot claim:

- overloaded
- tired
- free
- finished
- behind
- productive

unless explicit data supports it.

### Rule 5: Project State Requires Operational Data

Project Awareness cannot claim:

- build passed
- app is stable
- Jarvis is reliable
- agents completed work

unless logs, commits, tests, workflows, or reports prove it.

### Rule 6: Scores Require Calculation

No health, momentum, overload, productivity, or reliability score may appear unless the layer can show:

- source
- reason
- calculation

Otherwise:

```text
I do not have enough evidence to score that.
```

## Response Behavior

The founder should not normally see the full validation object.

Founder-facing answer should be compressed:

```text
I know the latest repo work, but I do not know your personal workload today. Project-wise, Personal Awareness docs were added. Personally, your state is unknown because today's school and study list is not loaded.
```

## Examples

### Question

```text
What happened today?
```

### If Git Evidence Exists

Reality output:

```json
{
  "state": "KNOWN",
  "realityConfidence": 0.91,
  "evidence": ["git log latest commit", "GitHub Actions latest run"],
  "unknownGaps": [],
  "blockedClaims": [],
  "allowedClaims": ["Personal Awareness docs were added and pushed"]
}
```

Founder-facing answer:

```text
Today we added the Personal Awareness design layer and pushed it. Remote workflows started for that commit; I would need a fresh check before claiming they passed.
```

### Question

```text
How overloaded am I this week?
```

### If No Personal Data Exists

Reality output:

```json
{
  "state": "UNKNOWN STATE",
  "realityConfidence": 0.0,
  "evidence": [],
  "unknownGaps": ["school tasks not loaded", "study workload not loaded", "sleep not loaded"],
  "blockedClaims": ["founder is overloaded this week"],
  "allowedClaims": ["personal workload data is not available"]
}
```

Founder-facing answer:

```text
I don't know yet. Your school, study, sleep, badminton, and family workload for this week are not loaded, so I cannot honestly judge overload.
```

## Integration With Existing Layers

### Project Awareness

Project Awareness must pass claims through Reality Awareness before answering operational project questions.

### Personal Awareness

Personal Awareness must pass claims through Reality Awareness before answering founder-life questions.

### Founder Brain

Founder Brain may reason about meaning, vision, fear, and strategy.

But if Founder Brain references current project or personal state, those factual claims must pass Reality Awareness.

## Success Criteria

Jarvis stops saying things like:

```text
You are overloaded.
The project is healthy.
Momentum is stalled.
Everything is going well.
```

unless those claims are backed by evidence.

Instead, Jarvis says:

```text
I don't know that yet.
```

That honesty is the feature.
