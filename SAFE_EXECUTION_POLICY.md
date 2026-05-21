# Safe Execution Policy

## Purpose

Safe Execution Layer Phase 1 allows only low-risk, deterministic maintenance actions. It is designed for careful junior-engineer behavior under CTO supervision, not autonomous feature development.

## Execution States

- PROPOSED: action plan exists but has not passed guardrails.
- APPROVED: low-risk dry-run or approved action passed guardrails.
- EXECUTING: approved non-dry-run action is running.
- COMPLETED: approved action finished.
- BLOCKED: guardrails rejected the action.
- ROLLED_BACK: execution failed and rollback instructions must be followed.

## Allowed Scopes

- documentation cleanup
- dead comment cleanup
- formatting normalization
- archive suggestion generation
- duplicate task cleanup proposals
- outdated log rotation proposals
- TODO organization
- report compression
- stale state cleanup proposals
- inactive memory cleanup proposals

## Forbidden Scopes

The execution layer must never modify:

- GitHub workflows
- Gradle structure
- package dependencies
- networking code
- telemetry code
- persistence code
- lifecycle logic
- prediction core
- swipe architecture
- authentication
- secrets
- privacy logic
- Kotlin or Java product logic
- `ai-cto/brain.js`
- WhatsApp webhook transport
- GitHub Actions configuration

It must not delete files automatically or push directly to `main`.

## Rollback Philosophy

Every action must include:

- reason
- rollback method
- affected files
- risk level
- validation step
- timestamp
- owning agent

If rollback instructions are missing, the action is blocked.

## Escalation Rules

- LOW risk deterministic actions may be dry-run approved.
- HIGH risk actions are blocked.
- Any forbidden path or forbidden domain keyword is blocked.
- Any action outside the allowlist is blocked.
- Any repeated execution loop is stopped by max-actions-per-cycle.
- Any rapid repeat run is stopped by cooldown.

## Execution Boundaries

Default mode is dry-run. Non-dry-run execution is intentionally narrow and currently limited to documentation whitespace normalization. All other action types must remain proposals until reviewed.
