# Project Awareness Engine

## Purpose

The Project Awareness Engine gives Jarvis and the WhatsApp agents operational reality before they answer project-status questions.

Founder Brain is good for vision, identity, strategy, doubt, and founder reflection. It is not the right first source for questions like:

- What happened today?
- What is blocked?
- What changed since yesterday?
- What is next?
- How is the Android app doing?

Those questions need repository evidence, build evidence, and current milestone context before any founder-style reasoning.

## Scope

This is an awareness layer only.

It must not:

- execute code
- start fixes
- mutate files
- dispatch workflows
- change Android runtime behavior
- change Founder Brain reasoning
- generate approval tokens

It may:

- inspect repository state
- summarize recent commits
- inspect GitHub Actions state
- inspect local Android build/APK state
- read agent activity logs
- read roadmap and milestone files
- produce a compact project snapshot

## Evidence Sources

The engine should collect these sources in order:

1. Git state
   - current branch
   - latest commit
   - recent commits
   - dirty working tree summary
   - pushed vs local commit status when available

2. GitHub Actions
   - latest Android CI run
   - latest Build and Distribute APK run
   - latest Product Lab run if relevant
   - latest Engineering Maintenance Worker run
   - status and conclusion only, not invented health scores

3. Android APK state
   - latest local APK build path
   - install state when a device is connected
   - installed versionName/versionCode
   - last install/update time
   - whether current APK matches latest commit only when verifiable

4. Agent activity
   - recent `ai-cto/agent-action-log.json` entries
   - recent brain scan timestamp
   - recent reports if already generated
   - no fake momentum or health if provenance is unavailable

5. Roadmap and milestone
   - `ai-cto/AGENT_ROADMAP.md`
   - `ai-cto/roadmap-lock.json`
   - Founder memory current stage files
   - active reliability sprint notes when present

6. Known blockers
   - failed builds
   - failed tests
   - failed deployments
   - missing runtime configuration
   - known real-device reliability issues
   - explicit founder-blocked decisions

## Current Reality Snapshot

As of 2026-06-05:

- Current stage: Jarvis reliability sprint, no new capabilities.
- Current milestone: reach reliable wake, command capture, Founder Brain answer, and voice output before persistent sessions or execution work.
- Last completed work: Vosk wake false-trigger filtering was tightened so partial hypotheses cannot wake Jarvis.
- Last commit: `ef2ea2e fix: prevent partial vosk wake triggers`.
- Previous stable CI reference: commit `7293425` completed Android CI, Build and Distribute APK, and Engineering Maintenance Worker successfully.
- Latest remote status: workflows for `ef2ea2e` were still in progress when checked.
- Active blocker: real-device wake and transcript reliability still need founder-facing benchmark proof.
- Next action: verify the newly installed APK with Jarvis wake service enabled from the app card, then measure accepted wakes vs rejected candidates.

## Answer Contract

Project-awareness answers must be short and evidence-based.

Good:

```text
Today we improved Jarvis wake reliability. Vosk partial results can no longer trigger a wake, and the APK was installed on your phone. The current blocker is real-device verification: we still need to prove whether false wakes are accepted wakes or only rejected candidates.
```

Bad:

```text
Health 30/100. Momentum stalled. Route confidence 83%. Memory sources used...
```

## Question Types Owned By Project Awareness

Route these to Project Awareness first:

- what happened today
- what changed today
- what changed since yesterday
- what is blocked
- what is next
- what are we doing
- how is work going
- how is the Android app doing
- did the build pass
- what did agents do
- what is the current milestone
- what is the latest commit
- what failed
- what is pending

## Question Types Not Owned By Project Awareness

Route these to Founder Brain first:

- why am I building this
- are we moving toward the dream
- what am I avoiding
- what belief changed
- who am I becoming
- what contradiction do you see
- what kills us strategically
- what should I be worried about as founder

## Metric Rules

The engine must never output health, momentum, or risk scores unless it can attach:

- source
- reason
- calculation

If provenance is missing, say:

```text
I do not have enough evidence to score that.
```

## Failure Behavior

If one evidence source fails, do not block the whole answer.

Use known evidence and state the gap naturally:

```text
I can see the latest local commit and dirty tree, but I cannot verify GitHub Actions right now.
```

Do not invent missing state.

## Integration Point

The intended integration point is before Founder Brain routing:

```text
Founder/Jarvis question
-> Project Question Router
-> Project Awareness Engine when operational
-> Founder Brain when reflective/strategic
-> compressed founder-facing answer
```

This keeps project-status answers grounded without weakening Founder Brain for vision and strategy.
