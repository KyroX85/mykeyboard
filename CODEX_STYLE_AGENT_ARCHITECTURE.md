# Codex-Style Agent Architecture

## Goal

Create a phone-operated long-horizon agent system that behaves like a governed execution loop, not a simple chat bot.

The system shape is:

User Goal -> Chief Agent -> Planner Agent -> Executor Agent -> Verifier Agent

If verification fails:

Verifier -> Planner -> Executor -> Verifier

The loop repeats within bounded limits until the task graph passes or needs founder review.

## Agents

### Chief Agent

- Understands the founder objective.
- Classifies the mode: product stewardship, Phase 2 Explain, governed execution, or phone-operated long-horizon work.
- Extracts constraints and success criteria.
- Delegates planning.
- Does not execute.

### Planner Agent

- Creates a structured task graph.
- Predicts likely failures before execution.
- Converts verifier failures into replanning input.
- Does not execute tasks.

### Executor Agent

- Executes one task only.
- Does not plan.
- Returns execution logs and artifacts.
- Stops at approval gates for mutation, phone control, or app actions.

### Verifier Agent

- Verifies task completion.
- Detects missing artifacts.
- Detects unsupported “done/fixed/implemented” claims.
- Returns pass/fail and sends failures back to the planner.

### Memory Layer

- Retrieves roadmap, product memory, founder memory, regression memory, and controlled execution context before planning.
- Keeps planning grounded in project state instead of generic answers.

## Future Phone Compatibility

The architecture includes gated capability slots for:

- Android Accessibility Service
- Notification access
- File access
- App control

These are not enabled as autonomous control paths. They are future adapters that require explicit permissions, safety rules, and founder approval before real actions.

## Safety Boundary

This system is designed for long-horizon execution discipline, not uncontrolled autonomy.

Current safe behavior:

- Can decompose goals.
- Can build task graphs.
- Can execute bounded internal tasks.
- Can verify artifacts.
- Can stop at approval gates.

Not allowed by default:

- Silent app control.
- Auto-send messages.
- Hidden notification capture.
- Autonomous protected keyboard mutation.
- Phone control without explicit user permission and governance.

## WhatsApp Trigger

Use:

```text
codex loop: build phone-operated long horizon execution
```

or:

```text
phone codex: create an Accessibility-backed task executor
```

The response shows the agents, task graph, predicted failures, future phone capabilities, and approval boundary.
