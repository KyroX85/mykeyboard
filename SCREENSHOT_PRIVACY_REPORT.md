# SCREENSHOT_PRIVACY_REPORT

Generated: 2026-05-29

## WHAT WAS VERIFIED

- Inspected Product Lab ADB screenshot script, scheduled GitHub workflow, report generator, and artifact upload paths.
- Checked for screenshot upload paths and WhatsApp media/report paths.

## FINDINGS

| Path | Classification | Evidence |
|---|---:|---|
| ADB screenshot script | THEORETICAL RISK | `capture-screenshots.ps1` captures the active device screen to `artifacts/product-lab/screenshots`. |
| GitHub Product Lab workflow | THEORETICAL RISK | Workflow boots emulator, installs APK, captures `emulator-smoke.png`, then uploads artifacts. |
| Scripted emulator tests | VERIFIED SAFE if isolated | Intended to use scripted phrases and emulator screens, not real user content. |
| Real phone manual capture | ACTIVE RISK if used | A screenshot command can capture any visible personal app content. |
| WhatsApp screenshot send | THEORETICAL RISK | Provider supports media/text links, but no automatic keyboard screenshot-to-WhatsApp path was found. |

## WHAT REMAINS THEORETICAL

- Actual artifact retention settings are GitHub-hosted and not controlled in current source.
- Whether a manually connected real phone is on a safe scripted screen before capture cannot be proven from repo code.

## ACTIVE RISKS

- Product Lab screenshot scripts are powerful enough to capture personal screens if pointed at a real device.

## DEAD CODE RISKS

- None found for old screenshot systems, but artifact upload expands privacy surface.

## DATA LEAK POSSIBILITY

Keyboard typed text leak through screenshots: not active in scripted emulator flow; possible if run manually on a real phone with personal content visible.

## UNVERIFIED PATHS

- GitHub artifact retention duration.
- Manual local screenshots outside `artifacts/product-lab`.
- WhatsApp media retention by Twilio/Meta.

## PROOF OF SAFETY

- Scheduled workflow uses an emulator and scripted install path.
- Product Lab reports are generated from heuristic evidence, not raw user typing.
- No automatic screenshot attachment to WhatsApp summaries was found.

## RECOMMENDED HARDENING

1. Add a Product Lab preflight that refuses screenshot capture unless emulator/device id is approved.
2. Add artifact retention limits to Product Lab workflow.
3. Do not upload screenshots from real phones by default.
4. Add a screenshot redaction/manual approval rule before WhatsApp media sharing.

## RISK SEVERITY

MEDIUM.

## TRUST IMPACT

Screenshots are useful product evidence, but they can become a privacy leak if the lab runs on a personal device instead of a controlled scripted emulator.
