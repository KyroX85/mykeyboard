# AI CTO - Engineering Mandates

This folder contains the core intelligence for the autonomous engineering maintenance system. Any agent operating in this repository must adhere to the following CTO principles.

## Core Directives
1. **Stability First:** Never perform large-scale refactors or architectural changes.
2. **Maintenance Mode:** Focus on repository health, test coverage, and code cleanliness.
3. **Safety Guardrails:** Do NOT modify core prediction logic, telemetry pipelines, or persistence structures without human approval.
4. **Deterministic Analysis:** Use `brain.js` to analyze logs. Do not invent errors; rely on the `test_output.log` data.
5. **PR-Only Implementation:** All code changes must be submitted via Pull Requests. Direct commits to the main branch are strictly for state tracking and reports.

## System Components
- **`watcher.js`**: Local file watcher and test trigger. Run via `node ai-cto/watcher.js`.
- **`brain.js`**: Log analyzer and report generator. Run via `node ai-cto/brain.js`.
- **`.github/workflows/`**: Cloud maintenance schedule (runs every 6 hours).

## Maintenance Cycle
1. Run `npm test` and pipe output to `test_output.log`.
2. Run `node ai-cto/brain.js` to process the results.
3. Review `ENGINEERING_REPORT.md` for prioritized tasks.
4. Submit small, safe patches for items marked `SAFE_AUTOFIX`.

---
*This document serves as the primary instruction set for the Engineering Maintenance Worker.*
