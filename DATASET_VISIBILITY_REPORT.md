# DATASET_VISIBILITY_REPORT

Generated: 2026-05-29

## VISIBLE SYSTEMS

- `ai-cto/product-evidence-archive.json`: aggregate-only product evidence.
- `ai-cto/product-operational-memory.json`: aggregate operational summaries.
- `ai-cto/product-lab/reports/`: generated UX reports.
- `memory/`: product judgment memory engines, not runtime typing datasets.

## INVISIBLE / PARTIAL SYSTEMS

- `ai-cto/datasets/`: not present in current working tree.
- `dataset-sync.js`: not present in current working tree.
- `collected_data-ARCHIVE`: not present in current working tree.

## UNVERIFIED PATHS

- Historical remote artifacts and older local folders outside this repo.
- Provider-side logs from prior runs.

## THEORETICAL EXPORT RISKS

- Any future dataset/export/sync file must be classified before use.
- `.ai-pipeline/reports` can contain generated diff/report artifacts outside tracked source.

## ACTIVE RISKS

- No active runtime dataset collection path for raw keyboard text was found.
- Product Lab screenshots are dataset-like evidence and must stay scripted/emulator-only.

## DEAD CODE RISKS

- Dataset absence can drift if future scripts recreate `ai-cto/datasets/`.

## CANONICAL DATA AUTHORITIES

- Dataset visibility engine: `ai-cto/dataset-visibility-engine.js`
- Registry source: `ai-cto/canonical-privacy-registry.js`

## AUDIT CONFIDENCE

MEDIUM. Dataset-like paths in this checkout were visible; external historical datasets remain unverified.

## RECOMMENDED HARDENING

1. Add any future dataset folder to the registry before writing data.
2. Reject raw typed text, user phrases, clipboard data, and recoverable swipe trails in dataset paths.
3. Keep product evidence aggregate-only.
