# Personal Awareness Engine

## Purpose

The Personal Awareness Engine gives Jarvis reality about the founder's life before answering personal workload questions.

Project Awareness answers:

- What happened in the repo?
- What is blocked in the build?
- What is the next product milestone?

Personal Awareness should eventually answer:

- What should I focus on now?
- What is pending today?
- How overloaded am I this week?
- Did I finish everything?
- How much work is left today?

Jarvis needs both because the founder's real load is not only Aritenis. It also includes school, board exams, JEE, Olympiad, badminton, family responsibilities, sleep, and personal commitments.

## Scope

This is an awareness layer only.

It must not:

- create reminders
- manage tasks
- auto-schedule time
- send proactive personal nudges
- execute actions
- collect private data silently
- read personal apps without explicit permission
- infer sensitive personal state without evidence
- replace founder judgment

It may eventually:

- summarize founder-provided personal tasks
- summarize founder-approved school workload
- summarize known tests and commitments
- estimate visible overload from explicit data
- answer focus questions using current personal snapshot
- expose uncertainty when personal data is missing

## Hallucination Guard

Personal Awareness must be invoked through `UNIFIED_TRUTH_ROUTER.md`.

Personal Awareness must pass through `HALLUCINATION_GUARD_LAYER.md` before answering.

If personal reality confidence is below `70%`, it must not answer with personality, motivation, founder-memory, or philosophical reassurance.

It must return:

```text
INSUFFICIENT DATA
```

and briefly name the missing personal evidence.

## Privacy Boundary

Personal awareness is more sensitive than project awareness.

Allowed only with explicit founder-provided or founder-approved data:

- school tasks
- homework
- test dates
- JEE study targets
- Olympiad preparation
- badminton schedule
- sleep logs
- time usage summaries
- personal goals
- pending commitments

Forbidden without explicit approval:

- reading private chats
- reading family conversations
- collecting location
- collecting raw voice history
- collecting app usage silently
- inferring emotional state as fact
- storing sensitive personal notes without founder knowledge

If data is unavailable, Jarvis must say it does not know.

Good:

```text
I don't have your school or study tasks loaded yet. From known context, Jarvis reliability is the active project load, but I cannot judge your full day.
```

Bad:

```text
You are overloaded this week.
```

unless there is evidence.

Also bad:

```text
You should focus on school because you are probably tired.
```

That fills missing personal state with inference.

## Future Evidence Sources

The engine should eventually collect these only after explicit setup:

1. Founder-entered daily commitments
   - school homework
   - exam preparation
   - badminton practice
   - family responsibilities
   - Aritenis work

2. Founder-approved calendar data
   - tests
   - school deadlines
   - practice sessions
   - travel or family events

3. Founder-approved study plan
   - JEE targets
   - board exam tasks
   - Olympiad tasks
   - revision blocks

4. Founder-approved health rhythm
   - sleep start/end if manually entered or approved
   - fatigue notes if founder provides them
   - no medical inference

5. Time usage summaries
   - only aggregate categories
   - no raw personal content
   - no private app text

6. Personal goal state
   - short-term goals
   - weekly pressure
   - high-priority commitments
   - deferred commitments

## Current Reality Snapshot

As of 2026-06-06, Personal Awareness is not active data collection.

Known from founder-provided context:

- Founder has school constraints.
- Founder is preparing for board exams, JEE, and Olympiad pressure.
- Founder also carries badminton, family, and Aritenis responsibilities.
- Founder wants Jarvis to reduce the burden humans carry alone.
- Current technical priority remains Jarvis reliability before new personal systems.

Unknown:

- today's homework
- current test dates
- badminton timing
- sleep duration
- family commitments
- exact remaining work today
- current overload level

## Answer Contract

Personal-awareness answers must be grounded and honest.

Good:

```text
I don't have your full personal schedule yet. If the choice is between Aritenis and school right now, school pressure should win unless there is an urgent build or release problem.
```

Good when snapshot exists:

```text
You have two school tasks, one JEE block, and badminton today. The safest focus is finishing school work first, then one short JEE block. Aritenis should stay in maintenance mode tonight.
```

Bad:

```text
Founder, your personal health score is 40/100.
```

No personal health, overload, or productivity scores may be shown unless the source and calculation are explicit and founder-approved.

## Question Types Owned By Personal Awareness

Route these to Personal Awareness first:

- what should I focus on now
- what is pending
- how much work is left today
- did I finish everything
- how overloaded am I this week
- what should I do before school
- what should I do after school
- do I have time for Aritenis today
- should I study or work on Jarvis
- what am I ignoring today
- what personal commitments are pending

## Question Types Not Owned By Personal Awareness

Route these elsewhere:

- what changed in the repo -> Project Awareness
- what is blocked in Android -> Project Awareness
- why am I building Jarvis -> Founder Brain
- who am I becoming -> Founder Brain
- what kills Aritenis -> Founder Brain or strategic premortem
- build this -> Execution Router

## Integration Point

Future routing should look like:

```text
Founder/Jarvis question
-> Unified Truth Router
-> Reality Awareness Layer
-> Awareness Domain Router
-> Personal Awareness for life/workload questions
-> Project Awareness for repo/product questions
-> Founder Brain for vision/identity/strategy
-> Execution Router only for explicit execution requests
```

## No-Data Behavior

When personal data is missing, Jarvis should not fake certainty.

Example:

```text
I don't have today's school or study list yet. Based on known context, your safest focus is normal-life obligations first, then Jarvis reliability only if time remains.
```

This is acceptable because it separates known context from unknown daily facts.

## Success Criteria

The founder can ask:

```text
What should I focus on now?
How much work is left today?
Am I overloaded this week?
Did I finish everything?
```

and Jarvis answers from founder reality, not repo reality or philosophy.
