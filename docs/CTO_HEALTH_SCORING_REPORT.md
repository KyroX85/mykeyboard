# CTO Health Scoring Report

## Scope

This pass adjusted founder-report health scoring logic so the CTO ecosystem can reflect current operational stabilization instead of permanently punishing historical debt.

## Changes Made

- Added severity-weighted current debt penalty.
- Added resolved issue decay by comparing current severity penalty with recent historical report severity.
- Added recovery momentum bonus for improving risk trend.
- Added stabilization bonus when verification passes, dangerous changes are clear, and current risk is low/medium.
- Added technical debt aging penalty bounded to avoid permanent catastrophic punishment.
- Added `ctoHealthScore`, `resolvedIssueDecay`, `recoveryMomentumBonus`, and `stabilizationBonus` to founder report JSON/Markdown/summary output.

## Scoring Principles

- Critical and high findings still dominate the score.
- Passing verification now matters.
- Resolved issues reduce penalty over time.
- Worsening trends are penalized.
- Stabilization work can improve the score without hiding active high-severity risk.

## Risk Assessment

- Regression severity: LOW.
- Workflow risk: LOW; no workflow files were changed.
- Reporting risk: LOW-MEDIUM; founder report output has additional fields but existing fields remain.

## Rollback Instructions

Revert `.ai-pipeline/scripts/generate-founder-report.ps1` to remove the added health-score fields and formulas.

## Validation Command

```powershell
.\gradlew.bat --no-daemon clean :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

## Confidence Score

7/10. The formula is intentionally simple and bounded. It should be reviewed against several historical report runs before treating the score as product-critical.
