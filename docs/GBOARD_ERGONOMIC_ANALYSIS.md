# Reference Ergonomics Analysis Pass

## Scope

This document uses the supplied Gboard screenshots as structural ergonomic references only. It does not recommend copying Gboard branding, assets, icons, colors, typography, animation, or proprietary styling. The goal is to extract measurable layout intelligence that can help Aritenis remain its own production-grade keyboard.

## Methodology

- Reference values are approximate image-space estimates from the supplied screenshots.
- Aritenis values are taken from `KeyboardSizingProfile`, `keyboard_container.xml`, and `KeyboardService`.
- Ratios are prioritized over absolute pixels because screenshots use different devices, crops, and scaling.
- The analysis focuses on typing confidence, thumb ergonomics, spacing rhythm, hierarchy, density, and risk.

## Current Aritenis Structural Baseline

For a typical 1080 px wide, 3.0 density portrait phone:

- Alpha key row height: about 50 dp.
- Number row height: about 25 dp, or 0.50x alpha row height.
- Suggestion row height: about 29 dp, or 0.58x alpha row height.
- Horizontal key gap: about 1.2 dp per side before density conversion.
- Vertical row margin: about 0.75x horizontal gap.
- Key vertical inset: about 0.38x horizontal gap when key height allows.
- Panel side padding: about 3.5 dp.
- Home-row side padding: about 3.0% of screen width, bounded to 8-13 dp.
- Bottom-row side padding: about 1.4% of screen width, bounded to 3-7 dp.
- Spacebar weight: 5.05.
- Shift/backspace weight: 1.28 each.
- Enter/action weight: 1.42.
- Emoji/mode-switch weight: 1.16 each.
- Emoji panel: fixed 8 columns, 244 dp grid height, 8 dp grid spacing, 10 dp horizontal padding.

## Gboard Reference Observations

### Alphabet Layout

Estimated from supplied screenshots:

- Keyboard-to-screen occupation: about 31-36% of visible phone height when the input field is active.
- Toolbar/suggestion strip: visually compressed, roughly 0.55-0.70x alpha row height depending on mode.
- Number row: when present, reads closer to a compact full row than a miniature strip, roughly 0.70-0.85x alpha visual mass in some captures.
- Alpha key horizontal gap: small but perceptible, usually about 4-7% of alpha key visual width.
- Alpha vertical row gap: about 3-6% of key height, enough to separate rows without making cards feel detached.
- Outer side padding: tight, usually less than one key gap plus panel margin.
- Modifier keys: visually quieter than alpha keys unless actively selected.
- Bottom row: spacebar usually occupies about 38-48% of row width; utility keys divide the remaining width into stable thumb zones.

### Numbers Layout

- Number grid uses larger central numeric targets than symbol side rails.
- Side operator rails are narrower than numeric cells, creating clear hierarchy.
- Bottom action row remains stable across symbol modes.
- The mode-switch key stays large enough for confident recovery to alpha layout.

### Symbols Layout

- Symbol rows preserve the same vertical rhythm as alpha rows.
- Dense symbol content is handled through grouping and proportional key widths, not extra vertical height.
- Backspace/action zones remain discoverable without visually overpowering the symbol grid.

### Long-Press Preview

- Popup size is large enough to confirm selection, but the base key grid remains stable underneath.
- Alternate symbols are visually subordinate to the primary letter, avoiding dense-label overload.

### Emoji Layout

- Emoji panel uses a top navigation/search hierarchy, a high-density emoji grid, and a bottom mode row.
- Emoji grid density is higher than alpha layout density because emoji selection is scan-based rather than flow-typing-based.
- Recent/frequent emoji rows carry stronger visual weight than category labels.
- Bottom mode row is persistent and easy to recover from, which prevents mode-trap anxiety.

## Aritenis vs Reference Comparison

| Area | Aritenis Current | Reference Pattern | Ergonomic Read |
| --- | --- | --- | --- |
| Alpha row height | 47-60 dp bounded, typical 50 dp | Similar production-safe range | Safe; do not shrink aggressively |
| Number row | 0.50x alpha row | Often visually closer to 0.70x+ | Aritenis may feel more secondary than reference |
| Suggestion row | 0.58x alpha row | Similar or slightly taller depending context | Acceptable, but hierarchy must stay quiet |
| Row rhythm | Gap tied to key gap | Reference keeps visible micro-separation | Aritenis ratio is good; avoid collapse |
| Horizontal gaps | Very compact | Compact but visibly breathable | Risk of perceived congestion on large thumbs |
| Edge padding | Very tight panel, row-specific offsets | Tight but optically balanced | Aritenis should not add broad outer padding |
| Home row inset | 8-13 dp | Similar stagger effect | Structurally sound |
| Bottom row | Spacebar 5.05, enter 1.42 | Spacebar 38-48% width, action zones stable | Aritenis is near target but should avoid louder modifiers |
| Emoji panel | 8 columns, fixed height | Dense grid with stronger mode/navigation structure | Aritenis may be functionally sparse compared with reference |
| Modifier hierarchy | Separate weights and drawable treatment | Quiet modifiers, alpha field dominant | Continue keeping modifiers visually quieter |

## Congestion Points

- Alpha rows use very compact horizontal margins. This helps density but can reduce perceived thumb breathing room.
- Number row at 0.50x alpha height may feel less tappable than reference number rows.
- Fixed emoji grid height can underuse tall devices and overcompress category scanning on short devices.
- The suggestion row sits structurally inside the panel, but perceived separation depends heavily on color and chip treatment.

## Wasted or Oversized Areas

- Current panel padding is already low. There is no clear evidence for reducing outer padding further.
- Alpha key height is ergonomically safe and should not be reduced for cosmetic density.
- The larger improvement opportunity is proportional hierarchy, not total keyboard height.

## Undersized Areas

- Number row perceived height is the clearest candidate. It is structurally 0.50x alpha height, while the reference often gives number access more visual confidence.
- Emoji navigation/mode controls are underdeveloped compared with reference structure, but changing that would be a feature/UI pass, not this analysis pass.

## Weak Hierarchy Zones

- Number row can read as too secondary even though it is always visible.
- Bottom modifiers can compete if contrast or label weight is too close to alpha keys.
- Suggestion row needs to feel embedded but not visually dominant.

## Thumb Reach Distribution

- Aritenis home-row and bottom-row side padding already preserve staggered reach.
- Reference layouts keep left/right edge targets confidence-building through sufficient visual mass, not large outer gaps.
- The safest Aritenis improvement is not more outer padding; it is slightly stronger perceived target confidence for top/number row and edge keys.

## What Makes Gboard Feel Lighter

- Utility controls are visually quieter than the primary typing field.
- The panel reads as one surface, with keys separated by tone and rhythm rather than heavy outlines.
- Dense rows still preserve micro vertical rhythm.
- Secondary rows are compact but not visibly starved.

## What Makes Gboard Feel Stable

- Mode rows keep consistent recovery controls.
- Bottom row proportions remain predictable across layouts.
- Edge keys keep enough visual mass to feel reachable.
- Suggestion/tool rows are subordinate to the typing grid.

## Safe Improvement Opportunities

1. Re-evaluate number-row ratio from 0.50x alpha height toward a bounded 0.56-0.62x range only if real-device thumb confidence confirms it.
2. Preserve current alpha key height while testing a very small horizontal breathing increase, capped by touch-confidence metrics.
3. Keep row vertical rhythm in the 1-2 dp visual range; do not collapse rows.
4. Maintain modifier quietness through tone/weight rather than shrinking touch regions.
5. Consider device-normalized emoji panel height in a future dedicated emoji pass, but avoid changing emoji behavior now.
6. Use the new local usage metrics to verify whether edge-zone correction patterns justify any spacing adjustment.

## Dangerous Changes To Avoid

- Shrinking alpha key height to make the keyboard look compact.
- Increasing gaps without evidence; this can create floating-card fragmentation.
- Enlarging number row enough to increase keyboard height pressure.
- Copying Gboard icons, colors, typography, or popup shapes.
- Making modifiers too small or low-contrast for accessibility.
- Changing touch routing, swipe logic, or prediction behavior during visual tuning.
- Treating screenshot aesthetics as stronger evidence than real-device thumb performance.

## Structurally Beneficial vs Aesthetic Imitation

### Structurally Beneficial

- Bounded number-row confidence increase if backed by large-thumb testing.
- Stable bottom-row occupation ratios.
- Micro vertical row separation that preserves scan rhythm.
- Edge-zone confidence tuning based on aggregate correction metrics.
- Emoji panel density analysis in a separate mode-specific pass.

### Merely Aesthetic Imitation

- Copying Gboard colors or teal action accents.
- Copying icon shapes.
- Copying popup appearance.
- Copying exact key corner radius.
- Copying exact font sizing or typeface.
- Recreating toolbar/emoji category styling.

## Recommended Next Pass Priority

1. Collect local usage intelligence for edge-zone and correction bursts on real devices.
2. If data confirms number-row hesitation or correction pressure, run a small number-row confidence pass.
3. If data confirms edge misses, tune perceived edge confidence without changing routing first.
4. Pause broad visual tweaking unless a measurable ergonomic issue appears.

## Release Risk

No runtime release risk from this analysis document. No production code behavior is changed.

## Regression Risk

Low for the report itself. Future changes based on this report should be treated as medium risk if they touch row height, number-row ratio, or key gaps.

## Rollback Complexity

Very low. Remove this document and its report guardrail if needed.

## Ergonomic Confidence Score

7.5/10. The broad structural direction is clear, but screenshot-derived measurements are approximate. Real-device Aritenis screenshots and usage metrics should drive any implementation pass.

## What Should Not Be Copied

- Branding identity.
- Color palette.
- Icons and glyph styling.
- Font choices.
- Animation behavior.
- Popup shape and exact styling.
- Emoji category artwork or toolbar presentation.

## Conclusion

Aritenis is already structurally close in key height safety and adaptive sizing. The main measurable gap is not overall size; it is proportional confidence: number-row authority, edge-key perceived target strength, bottom-row hierarchy, and emoji-panel density. The next implementation pass should be small, reversible, and driven by real-device metrics rather than visual imitation.
