# Long-Horizon Product Stewardship Report

## Scope

This pass adds bounded product stewardship only. It does not edit Android keyboard runtime files, swipe logic, predictor logic, UI resources, workflows, dependencies, or execution permissions.

## Systems Added

- Roadmap lock state in `ai-cto/roadmap-lock.json`
- Aggregate product evidence archive in `ai-cto/product-evidence-archive.json`
- Product wisdom memory in `ai-cto/product-wisdom-memory.json`
- Long-horizon stewardship functions in `ai-cto/product-governance.js`
- Validation coverage in `ai-cto/scripts/test-long-horizon-product-stewardship.js`

## Roadmap Protections

The roadmap lock persists:

- founder vision
- current phase
- product philosophy
- UX priorities
- anti-goals
- rejected directions
- never-do-again patterns

Proposals are blocked when they conflict with Phase 1 stabilization, introduce architecture expansion without UX gain, add cloud AI to typing, mutate dependencies/workflows, or revive rejected directions.

## Autonomy Reductions

Autonomy becomes more conservative when:

- founder feedback is stale
- real-device evidence is missing
- successful product validation is missing
- product stability drops
- product drift rises

The restrictive modes are:

- `LOW_RISK_MAINTENANCE_ONLY`
- `ANALYSIS_AND_PROPOSALS_ONLY`
- `PRESERVATION_ONLY`

## Drift Prevention

The drift detector flags:

- complexity growth
- module sprawl
- duplicate governance
- wrapper proliferation
- memory duplication
- report inflation
- feature creep
- cosmetic churn
- smart-sounding work without UX gain

High drift reduces autonomy to preservation behavior.

## Product Evidence Archive

The evidence archive stores only aggregate metrics:

- correction load
- swipe stability
- symbol friction
- mode-switch friction
- responsiveness
- edge-key confidence

It explicitly excludes raw text, sentences, and keystroke history.

## Trusted Experiment Rules

Every experiment proposal must include:

- expected UX gain
- expected risk
- rollback simplicity
- affected trust scores
- affected subsystems
- confidence level
- evidence source

Experiments expire if validation does not prove improvement, time expires, or rollback frequency rises.

## Product Stability Index

The stability index scores:

- regressions
- rollback frequency
- correction load
- swipe instability
- runtime instability
- unresolved friction
- fake progress rate
- trust score trend

Low scores reduce autonomy automatically.

## Founder Absence Mode

After sparse founder interaction, priorities shift to:

- preservation
- maintenance
- evidence collection
- regression prevention
- roadmap protection

Blocked during absence:

- expansion
- redesign
- experimentation
- architecture growth
- product hot-path edits

## Runtime Impact

None on the Android keyboard. This pass adds Node-side policy/state logic only.

## Memory Impact

Low. Three bounded JSON files were added. Product evidence stores a maximum rolling archive of aggregate entries. Product wisdom lists are capped by the writer.

## Regression Risk

Low for keyboard runtime. Medium for CTO behavior if future routing wires these checks too aggressively. The checks currently fail closed toward lower autonomy.

## Rollback Complexity

Low. Remove the added JSON/report/test files and revert the `product-governance.js` additions.

## Readiness Score

Long-horizon autonomy maturity after this pass: 4/10.

Reason: roadmap protection and decay behavior are now explicit, but this still does not prove real product improvement. It only makes unsupervised operation safer.
