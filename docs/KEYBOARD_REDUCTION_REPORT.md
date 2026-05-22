# Aritenis AI Keyboard Reduction Report

## Scope

This cleanup pass reduced visual-resource complexity without changing keyboard behavior.

Systems intentionally not changed:

- touch geometry
- row heights
- spacing and gaps
- swipe system
- prediction engine
- telemetry, networking, privacy, and persistence
- lifecycle handling
- accessibility behavior
- routing logic
- haptics

## SAFE REMOVE

Removed unused visual/style remnants that had no active references from Kotlin, XML layouts, drawable references, or tests:

- `app/src/main/res/drawable/bg_dark.xml`
- `app/src/main/res/drawable/bg_light.xml`
- `app/src/main/res/drawable/bg_purple.xml`
- `app/src/main/res/drawable/keyboard_bg.xml`
- `app/src/main/res/drawable/bg_image.xml`
- `app/src/main/res/drawable/bg_keyboard.jpg`
- `app/src/main/res/anim/press.xml`
- `app/src/main/res/anim/release.xml`

Reason:

- The keyboard now uses `keyboard_container_bg.xml`, `key_bg.xml`, `key_bg_modifier.xml`, `key_bg_action.xml`, and `key_preview_bg.xml`.
- The removed background resources were remnants from older image/theme experiments.
- The removed animation XML files were not referenced through `@anim/...` or `R.anim...`.

## CONSOLIDATE

No drawable files were consolidated in code during this pass.

Reason:

- `key_bg.xml`, `key_bg_modifier.xml`, and `key_bg_action.xml` intentionally duplicate selector structure with different tonal values.
- Consolidating them into a runtime abstraction or generated drawable would increase complexity and risk visual hierarchy drift.
- The current duplication is small, explicit, and guardrailed by tests.

Future consolidation candidate:

- Move keyboard surface colors into a single XML color resource group if visual themes are formally introduced.

Current recommendation:

- Do not introduce a theming abstraction yet.

## KEEP

Kept active or high-risk resources:

- `keyboard_container_bg.xml`
- `key_bg.xml`
- `key_bg_modifier.xml`
- `key_bg_action.xml`
- `key_preview_bg.xml`
- `key_preview.xml`
- launcher resources
- `logo.png`

Reason:

- These are actively referenced or part of launcher/application identity.
- Key preview resources are active production feedback and should not be removed as cleanup.

## HIGH RISK REMOVE

Do not remove without a dedicated behavior pass:

- key preview popup logic
- `key_preview.xml`
- `key_preview_bg.xml`
- `key_bg_modifier.xml`
- `key_bg_action.xml`

Reason:

- Preview and key hierarchy are part of perceived typing confidence.
- Removing or collapsing them could affect press feedback clarity.

## Duplicated Drawable Logic

Detected:

- `key_bg.xml`, `key_bg_modifier.xml`, and `key_bg_action.xml` share the same selector/layer-list shape.

Decision:

- Keep for now.

Rationale:

- Duplication is intentional and small.
- Each file encodes a distinct hierarchy role: alpha, modifier, action.
- Guardrails already prevent excessive radius, gradients, and shadow regression.

## Repeated Color Coordination

Detected:

- Keyboard surface colors appear in both XML drawables and `KeyboardService.kt` text color logic.

Decision:

- Keep for now.

Rationale:

- Moving colors into a new theme abstraction would be an architecture/style-system change.
- Current color usage is explicit and low runtime risk.

Future improvement:

- If theme expansion is approved, centralize surface/text colors in resource values.

## Stale Preview Popup Logic

Detected:

- Preview popup uses separate XML and a stronger popup visual hierarchy than the base keyboard.

Decision:

- Keep.

Rationale:

- The preview popup is active and supports typing confidence.
- Removing or visually changing it is not a cleanup-only operation.

## Unnecessary UI Helper Methods

No safe helper removal was identified in this pass.

Reason:

- Cleanup, commit safety, preview handling, and sizing helpers are referenced by guardrail tests or lifecycle paths.
- Removing helper boundaries would increase regression risk.

## Scores

Complexity score: 7/10

- Improved by removing obsolete visual resources.
- Remaining duplication is intentional and bounded.

Visual consistency score: 8/10

- Primary typing surface has consistent hierarchy.
- Preview and emoji surfaces remain separate maturity areas.

Maintainability score: 8/10

- Dead visual artifacts removed.
- Guardrails preserve maturity decisions.
- Further consolidation should wait for a real theme-system need.

## Runtime Impact

Runtime impact: neutral.

- No Kotlin runtime path changed.
- No input, prediction, swipe, telemetry, persistence, lifecycle, accessibility, routing, haptic, or layout behavior changed.

## APK Impact Estimate

Estimated raw resource removal: approximately 35 KB before packaging/compression.

Most of the reduction comes from removing `bg_keyboard.jpg`.

## Regression Risk

Regression risk: LOW.

Reason:

- Removed files were unreferenced.
- Active keyboard, preview, launcher, and logo resources were preserved.

## Rollback Complexity

Rollback complexity: low.

- Restore the removed resource files if a downstream branch still references them.

## Stop Condition

Do not continue cleanup into active key or preview drawables unless there is evidence of dead references or a dedicated approved visual behavior change.
