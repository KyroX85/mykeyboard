# Personal Question Router

## Purpose

The Personal Question Router decides whether a founder question needs personal-life awareness, project awareness, Founder Brain reflection, or execution handling.

Jarvis must not answer every question from repo state.

It also must not answer practical life questions with philosophy.

## Core Rule

If the founder asks about today's focus, pending work, school load, study load, time, overload, or commitments, route to Personal Awareness first.

If the founder asks about commits, builds, blockers, repo progress, or Android state, route to Project Awareness first.

If the founder asks about meaning, identity, fear, dream, contradiction, or strategy, route to Founder Brain first.

Execution only activates when the founder explicitly asks Jarvis to do something.

## Route Table

| Founder question pattern | Route | Reason |
| --- | --- | --- |
| What should I focus on now? | Personal Awareness | Needs current life workload, not repo status. |
| What is pending? | Personal Awareness unless project context is explicit | Usually asks about personal obligations. |
| How much work is left today? | Personal Awareness | Needs daily commitments and task completion. |
| Did I finish everything? | Personal Awareness | Needs personal task state. |
| How overloaded am I this week? | Personal Awareness | Needs school, study, sleep, family, and Aritenis load. |
| Should I study or work on Jarvis? | Personal Awareness plus Project Awareness | Needs life load and project urgency. |
| What should I do before school? | Personal Awareness | Needs school-day obligations. |
| What should I do after school? | Personal Awareness | Needs remaining personal commitments. |
| Do I have time for Aritenis today? | Personal Awareness plus Project Awareness | Needs available time and project urgency. |
| What changed today? | Project Awareness | Ambiguous, but usually project/repo unless founder says life. |
| What is blocked? | Project Awareness unless personal context is explicit | Usually operational/project blocker. |
| How is the Android build doing? | Project Awareness | Requires build evidence. |
| What is our next milestone? | Project Awareness | Requires roadmap/project state. |
| Why am I building Jarvis? | Founder Brain | Vision and identity. |
| Who am I becoming? | Founder Brain | Identity reconstruction. |
| What am I avoiding? | Founder Brain | Reflection. |
| Remind me / schedule / create task | Future Execution or Task System | Not part of this design-only layer. |

## Ambiguity Rules

Some questions are ambiguous:

```text
What is pending?
What should I do now?
What happened today?
```

Resolve by context:

1. If previous conversation was about school or life, prefer Personal Awareness.
2. If previous conversation was about repo/build/Jarvis reliability, prefer Project Awareness.
3. If no context exists, answer with both briefly and state uncertainty.

Example:

```text
I can answer project pending work, but I don't have your personal task list loaded. Project-wise, the next item is Jarvis wake verification. Personally, I need today's school/study list before judging.
```

## Classification Priority

Use this order:

1. Explicit execution request
2. Personal operational question
3. Project operational question
4. Founder reflection or strategy
5. Product discussion
6. Clarify only if answering would create false certainty

## Personal Awareness Answer Style

Personal answers should be:

- calm
- direct
- practical
- honest about unknowns
- protective of the founder's real life
- short enough for voice

Do not show:

- route labels
- confidence scores
- memory headers
- diagnostics
- internal framework names
- fake overload scores

## Examples

### Question

```text
What should I focus on now?
```

### Good Answer With Missing Data

```text
I don't have today's school or study list loaded. Given what I know, school and exam work should win first. Aritenis should only get a small reliability check if your main obligations are clear.
```

### Good Answer With Data

```text
Finish homework first, then one JEE revision block. Jarvis can wait tonight unless there is a build failure.
```

### Bad Answer

```text
Today we tightened Vosk wake filtering and pushed commit ef2ea2e.
```

That is project reality, not personal focus.

## Mixed Personal + Project Questions

Question:

```text
Should I study or work on Jarvis?
```

Good:

```text
If there is no urgent Jarvis failure, study should win. Jarvis is in reliability mode, so one measured test is useful, but it should not consume the time needed for school or JEE.
```

This uses both personal and project reality.

## Forbidden Outputs For Personal Questions

Personal questions must not return:

- repo-only status
- Android build status unless relevant
- Founder Brain philosophy unless asked
- task plans
- approval tokens
- fake productivity scores
- fake overload scores
- reminders or schedules unless explicitly supported later

## Success Criteria

The founder can ask:

```text
What should I focus on now?
What is pending?
How much work is left today?
Did I finish everything?
How overloaded am I this week?
```

and Jarvis answers from founder reality, not only Aritenis reality.

## Future Integration

The full awareness router should eventually be:

```text
Founder/Jarvis question
-> Domain classification
-> Personal Awareness for founder-life workload
-> Project Awareness for Aritenis operational state
-> Founder Brain for vision and identity
-> Execution Router only for explicit action requests
```

This preserves the long-term Jarvis direction:

```text
Project Reality + Founder Reality -> Better decisions before execution
```
