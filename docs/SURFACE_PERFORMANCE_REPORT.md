# Surface Performance Report

## Scope

This phase audited keyboard surface cost under the constraint that touch geometry, row heights, spacing rhythm, swipe logic, prediction, haptics, accessibility behavior, and visual design must not change.

## Findings

- Removed bitmap-backed background resources were already deleted in the prior reduction pass.
- Active keyboard panel uses drawable/XML surfaces, not the old bitmap background.
- Key drawables use flat selector/layer-list resources with no gradient or bitmap surface dependency.
- `keyboard_container.xml` uses `wrap_content` for IME content sizing and avoids full-screen filler.
- Existing sizing guardrails keep effective key height above ergonomic thresholds.

## Safe Changes Made

No additional surface code changes were made in this pass. Further surface edits would be visual/layout changes and would violate the current priority unless backed by real-device evidence.

## Render Cost Impact

- Current surface is already simplified compared with the previous bitmap-backed state.
- No new overdraw was introduced.
- No new animations, bitmaps, or layout reinflation paths were added.

## Minimum Target Protection

- Existing `KeyboardSizingProfileTest` enforces ergonomic key heights and bounded spacing relationships.
- Existing visual-remnant guardrails keep old bitmap/dark/light/purple backgrounds removed.

## Regression Risk

- Severity: LOW because no runtime surface behavior changed.
- Future risk: MEDIUM if spacing or row heights are adjusted without real-device metrics.

## Rollback Complexity

None for this pass. It is a report-only surface audit.

## Confidence Score

9/10 for not changing stable surface behavior. Any future surface optimization should be tied to measured overdraw or real-device latency data.
