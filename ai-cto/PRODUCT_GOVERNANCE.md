# Aritenis AI Product Governance

## Priority Order

1. Product trust
2. Runtime stability
3. Typing confidence
4. Swipe reliability
5. UX consistency
6. Real-device evidence
7. Safety and rollback
8. Maintainability
9. Operational automation
10. Cosmetic cleanup

## Protected Product Files

Protected product files include:

- `KeyboardService.kt`
- `SwipeWordResolver.kt`
- `SwipeGestureTracker.kt`
- `SwipeTrailView.kt`
- `BasicPredictor.kt`
- `KeyboardMetrics.kt`
- `ProductInsightEngine.kt`
- key sizing, symbol, haptic, keyboard layout, and key drawable files
- swipe, predictor, metrics, and runtime hot paths

These files must not be directly modified through WhatsApp execution.

## Product Change Rules

Product changes must be classified before execution:

- `SAFE_MAINTENANCE`
- `LOW_PRODUCT_RISK`
- `MEDIUM_PRODUCT_RISK`
- `HIGH_PRODUCT_RISK`
- `ARCHITECTURE_RISK`
- `UX_RISK`
- `SWIPE_RISK`
- `PREDICTION_RISK`
- `RUNTIME_RISK`

Any protected product file requires proposal mode, branch isolation, validation evidence, and founder approval.

## Reality Validation Gate

Before any product-level approval, agents must verify:

- build passed
- tests passed
- lint passed
- no forbidden files touched
- no giant diffs
- no duplicate architecture
- no fake progress
- no unnecessary abstractions

Unless `ai-cto/real-device-evidence.json` or `REAL_DEVICE_EVIDENCE.md` exists with evidence, every product proposal must state:

`NO REAL-DEVICE EVIDENCE YET`

## Direct Main Push Policy

Direct `main` push is allowed only for:

- docs
- tests
- reports
- tiny safe maintenance

Product/runtime changes must not be pushed directly to `main`.

## Founder Reality Mode

Agents must use truthful uncertainty:

- not enough evidence yet
- needs real-device testing
- possible regression risk
- confidence low
- proposal only
- unsafe to automate currently

Agents must not claim certainty, AGI-like understanding, or product improvement without evidence.

## Long-Horizon Stewardship

The product stewardship layer must become more conservative when founder feedback, real-device evidence, or successful product validation is missing.

Durable stewardship state:

- `ai-cto/roadmap-lock.json`
- `ai-cto/product-evidence-archive.json`
- `ai-cto/product-wisdom-memory.json`

Roadmap conflicts block proposals when they introduce:

- cloud AI in live typing
- dependency or workflow mutation
- architecture expansion without UX gain
- companion behavior before Phase 1 stabilization
- uncontrolled swipe or predictor rewrites
- report generation presented as product progress

Founder absence mode shifts priorities to preservation, maintenance, evidence collection, regression prevention, and roadmap protection. It blocks expansion, redesign, experimentation, architecture growth, and product hot-path edits.

Evidence archives must contain aggregate metrics only. They must never store raw text, sentences, or keystroke history.
