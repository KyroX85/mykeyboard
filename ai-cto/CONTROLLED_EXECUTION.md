# Controlled Execution Layer

## A. Exact Workflow Changes
- `.github/workflows/engineering-maintenance.yml` runs real Android validation through `node ai-cto/scripts/run-android-validation.js`.
- Validation runs these Gradle tasks exactly:
  - `:app:testDebugUnitTest`
  - `:app:assembleDebug`
  - `:app:lintDebug`
- Workflow installs Temurin Java 17 before Gradle validation.
- Workflow runs `node ai-cto/scripts/safe-autofix.js --apply` in an isolated `safe-autofix` job.
- Workflow creates PRs instead of pushing report, memory, or autofix changes directly to `main`.
- Workflow concurrency is branch-scoped to prevent overlapping maintenance runs.

## B. Exact Scripts Added
- `ai-cto/scripts/run-android-validation.js`
  - Runs the required Gradle tasks.
  - Captures combined output in `test_output.log`.
  - Writes structured validation results to `ai-cto/validation-results.json`.
- `ai-cto/scripts/safe-autofix.js`
  - Applies only deterministic low-risk cleanup.
  - Writes `ai-cto/autofix-summary.json`.
- `ai-cto/brain.js`
  - Parses Android validation findings.
  - Performs deterministic deep scan checks.
  - Maintains 30-day trend history.
  - Generates the founder CTO digest.

## C. Exact Repo Permissions Required
GitHub Actions job permissions:

- `contents: write`
  - Required to create PR branches.
- `pull-requests: write`
  - Required to open and update CTO maintenance PRs.

Repository secrets:

- `MAIL_SERVER`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `REPORT_RECIPIENT_EMAIL`

## D. Safety Boundaries Implemented
Allowed autonomous changes:

- Stale temporary file cleanup.
- Root documentation whitespace cleanup.
- Android resource XML final newline normalization.

Forbidden autonomous changes:

- Predictor logic.
- Database/storage.
- Networking.
- Privacy/telemetry.
- Lifecycle rewrites.
- Gesture/swipe logic.
- Architecture rewrites.

Critical and dangerous findings are report-only and marked for review.

## E. Rollback Strategy
- Revert the controlled execution commits if the workflow behaves incorrectly.
- Disable scheduled execution by commenting the `schedule` block in `.github/workflows/engineering-maintenance.yml`.
- Close CTO-generated PRs without merging if their diffs are not acceptable.
- Restore the previous `ai-cto/brain.js` and workflow from Git history if report generation regresses.

## F. Failure Containment Strategy
- Gradle validation never blocks report generation; failures are captured as findings.
- Email runs after report preparation so the founder is informed even when validation fails.
- Report and memory updates go to PRs, not direct protected-branch pushes.
- Workflow branches are fixed (`cto/low-risk-maintenance`, `cto/report-memory`) to avoid PR sprawl.
- Workflow triggers on normal branch pushes, schedule, or manual dispatch, and ignores `cto/**` branches to prevent PR branch recursion.

## G. Abuse Prevention Strategy
- No self-modifying workflow loops.
- No direct protected-branch pushes.
- No auto-merge.
- No model-generated architecture changes.
- No broad source rewrites.
- PR labels are embedded in titles:
  - `[LOW-RISK]`
  - `[REVIEW REQUIRED]`
  - `[DANGEROUS]` for future report-only escalation if added.

## H. Validation Proof
Local validation performed:

- `node --check ai-cto/brain.js`
- `node --check ai-cto/scripts/run-android-validation.js`
- `node --check ai-cto/scripts/safe-autofix.js`
- `node ai-cto/scripts/safe-autofix.js`
- `node ai-cto/scripts/run-android-validation.js`
- `node ai-cto/brain.js`

Local Gradle execution failed because the desktop shell does not have `JAVA_HOME` configured. The workflow installs Java 17 before Gradle validation, so GitHub Actions is the authoritative validation environment.

## I. Release Readiness Score
Current controlled execution readiness: `72/100`.

Blocking gaps:

- Needs successful GitHub Actions validation proof after merge.
- Safe autofix PRs still require human review before merge.
- Dangerous approval workflow is report-only and not yet formalized as issues.

Ready capabilities:

- Real Android validation command path.
- Structured failure parsing.
- PR-only execution.
- 30-day trend memory.
- Founder digest.
- Conservative safety boundaries.
