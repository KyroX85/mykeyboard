# AUDIT_BLINDSPOT_REPORT

Generated: 2026-05-29

## VISIBLE SYSTEMS

- Canonical registry sees runtime, predictor storage, metrics, ingestion, archives, product lab, WhatsApp, workflows, backup rules, and cloud helpers.

## INVISIBLE / PARTIAL SYSTEMS

- Historical GitHub artifacts.
- External provider logs/dashboards.
- Any unmounted device storage.

## UNVERIFIED PATHS

- Git history audit.
- Supabase table rows and policies.
- Render runtime logs.
- Twilio/Meta/NVIDIA retention.

## THEORETICAL EXPORT RISKS

- Audits run from product chat can miss canonical state unless routed through registry.
- Ignored generated folders can be missed by source-only checks.

## ACTIVE RISKS

- `.ai-pipeline/reports` exists locally and can contain generated outputs.
- Founder memory is operational text, not keyboard text, but still a privacy surface.

## DEAD CODE RISKS

- Dormant upload helpers can be missed if only active call paths are inspected.

## CANONICAL DATA AUTHORITIES

- Audit blindspot engine: `ai-cto/audit-blindspot-engine.js`
- Context unifier: `ai-cto/audit-context-unifier.js`

## AUDIT CONFIDENCE

MEDIUM-HIGH for current source. MEDIUM overall because external history is not visible locally.

## RECOMMENDED HARDENING

1. Require `AUDIT VISIBILITY CONFIDENCE` in every future privacy report.
2. Include ignored generated folders in privacy scans.
3. Treat absent systems as evidence-backed absent, not globally impossible.
