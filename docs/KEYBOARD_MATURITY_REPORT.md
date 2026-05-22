# Aritenis AI Keyboard Maturity Report

## Scope

This report covers the production visual maturity state of the keyboard surface after the recent density, hierarchy, and dark-theme calibration passes.

Systems intentionally not changed in this pass:

- swipe architecture
- prediction engine
- telemetry, privacy, networking, and persistence
- lifecycle handling
- accessibility behavior
- touch routing
- haptics
- row heights, touch geometry, and spacing gaps

## Current Maturity State

The keyboard has moved away from a prototype-like surface toward a calmer production surface:

- The keyboard panel, suggestion row, number row, and key grid now share a more unified dark surface language.
- Key shadows are near-flat and no longer define the keyboard structure.
- Alpha keys remain the primary visual field.
- Modifier, space, and action keys are visually quieter than the alpha field.
- Suggestion cells are transparent text areas embedded in the panel rather than separate card-like chips.
- Labels use single-line rendering and disabled font padding for more stable optical centering.

## Measurable Improvements Already Present

- Touch geometry is protected by tests and remains unchanged during visual passes.
- Row and key sizing are controlled by `KeyboardSizingProfile` rather than isolated layout constants.
- Key radius is guarded at `4dp` to avoid returning to large floating-card keys.
- Key elevation is held at `0f` during normal, released, and cleanup states.
- Suggestion row and keyboard panel share the same surface color.
- Key drawables avoid gradients and use very low shadow alpha.
- Hot-path tests guard against persistence, networking, serialization, layout inflation, and blocking work in typing methods.

## Visual Resource Audit

### Key Drawables

The three active key drawables are:

- `key_bg.xml`
- `key_bg_modifier.xml`
- `key_bg_action.xml`

They intentionally duplicate the same selector/layer-list structure with different tonal values. This duplication is acceptable for now because it keeps the hierarchy explicit and avoids adding runtime abstraction or theme complexity.

Current risk:

- Future color edits may drift between these files.

Recommended guardrail:

- Keep tests that assert radius, low shadow alpha, no gradient use, and expected hierarchy colors.
- Do not introduce drawable inheritance or runtime drawable mutation unless there is a clear maintenance failure.

### Keyboard Panel

`keyboard_container_bg.xml` is now a flat solid surface. This is the right direction for production maturity.

Current risk:

- Returning gradients or image overlays would make the keyboard feel less system-grade and more custom-themed.

Recommended guardrail:

- Keep the panel as a flat surface unless a full theme system is explicitly approved.

### Suggestion Row

The suggestion row is visually integrated into the panel surface and suggestions render as text, not raised chips.

Current risk:

- Suggestions may feel slightly understated on low-brightness displays.

Recommended validation:

- Test in low brightness, high brightness, and outdoor conditions before adjusting contrast again.

## Remaining Production Weaknesses

1. Modifier/action glyphs are still text glyphs, not a unified icon system.
   - Risk: visual weight can vary by Android font/OEM.
   - Current recommendation: do not introduce an icon dependency yet. Existing glyphs are stable and cheap.

2. Key drawable colors are still manually coordinated across XML files.
   - Risk: future color drift.
   - Current recommendation: keep guardrail tests. Avoid creating a larger theming layer until product direction requires it.

3. The preview popup remains visually stronger than the base keyboard.
   - Risk: may feel less mature than the base surface.
   - Current recommendation: do not change it in this pass because popup preview is functional feedback, not base-surface maturity.

4. The emoji panel still uses older standalone styling.
   - Risk: mode switch may feel visually less integrated.
   - Current recommendation: defer. This pass is about the primary typing surface.

## Subjective-Risk Warnings

Further changes are likely to become subjective if they involve:

- increasing or decreasing key gaps without miss-rate data
- changing row heights without fatigue or reach evidence
- retuning dark colors without real-device brightness comparisons
- changing font weight without readability testing
- replacing glyphs with icons without checking OEM/device rendering

These changes should pause unless real-device testing identifies a specific measurable failure.

## Stop Conditions

Stop visual tuning if any of the following occur:

- touch confidence decreases
- horizontal key area is reduced
- row rhythm becomes unstable across devices
- modifier/action discoverability drops
- low-brightness readability worsens
- changes only improve screenshots and not real typing
- regression risk exceeds visual benefit

## Regression Risk

Current regression risk: LOW.

Reason:

- Recent maturity work has been limited to resource tones, typography rendering, and guardrails.
- Touch geometry and input behavior were not changed.
- Validation continues to run through unit tests, debug assemble, and lint.

## Release Readiness Score

Current visual maturity release readiness: 8/10.

Rationale:

- Primary typing surface is stable, calm, and guarded.
- Remaining weaknesses are polish-level and should be validated on real devices before more code changes.
- Further visual work without real-device evidence risks churn.

## Recommended Next Step

Pause visual tuning and run a real-device comparison checklist:

- rapid two-thumb typing
- one-handed typing
- low-brightness readability
- outdoor readability
- number-row reach
- bottom-row modifier confidence
- suggestion row scanability
- 20-minute fatigue session

Only resume visual changes if these tests reveal a specific, repeatable issue.
