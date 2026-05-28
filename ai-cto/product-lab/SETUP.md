# Aritenis Scheduled Product Validation Lab

## Purpose

This lab belongs to Phase 1 - Trusted Keyboard. It exists to collect visual and scripted evidence before agents propose keyboard changes.

## Free Dependencies

- Android Studio / Android SDK
- ADB
- GitHub Actions
- Optional Maestro CLI for richer local scripted flows
- Optional manually supplied Gboard or SwiftKey baseline screenshots

## Runtime Flow

1. Build debug APK.
2. Boot GitHub Actions Android emulator.
3. Install Aritenis APK.
4. Enable Aritenis IME.
5. Capture screenshots and run scripted flows where tooling is available.
6. Compare current screenshots/metrics against previous stable baseline.
7. Generate reports and WhatsApp-ready summary.
8. Wait for founder approval before any implementation proposal.

## Local Flow

```powershell
npm.cmd run cto:product-lab:test
node ai-cto/scripts/run-scheduled-product-lab.js
```

ADB helper scripts live in `ai-cto/product-lab/adb/`.

## Restrictions

- No raw personal typing.
- No stored words or sentences beyond scripted test phrases.
- No cloud telemetry.
- No automatic product-code mutation.
- No hot-path rewrites.
- No bypass of preservation mode or governance.

## Operational Limitations

- GitHub emulator runs are temporary and may be slow.
- Maestro execution in GitHub may need follow-up installation tuning.
- Mature keyboard comparison depends on baseline screenshots being available.
- Human typing feel remains partly theoretical until founder or physical-device validation confirms it.

## Maturity Score

Current maturity: 54/100.

Reason: the scheduled evidence/reporting structure exists, but live GitHub emulator execution and real baseline screenshot comparison still need workflow-run validation.
