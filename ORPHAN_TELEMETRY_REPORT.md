# ORPHAN_TELEMETRY_REPORT

Generated: 2026-05-29

## VISIBLE SYSTEMS

- Supabase helper in `KeyboardService.kt`.
- Local product ingestion in `product-metrics-ingest.js`.
- WhatsApp provider fallback in `whatsapp-provider.js`.
- NVIDIA client in `nvidia-nim-client.js`.
- GitHub artifact upload workflows.

## INVISIBLE / PARTIAL SYSTEMS

- External provider retention and logs.

## UNVERIFIED PATHS

- Remote telemetry remnants outside this checkout.
- Historical workflow artifacts.

## THEORETICAL EXPORT RISKS

- Generic network helpers can serialize future sensitive payloads.
- Artifact uploads can preserve generated data.

## ACTIVE RISKS

- NVIDIA client can send founder operational prompts when configured.
- WhatsApp sends operational summaries externally.

## DEAD CODE RISKS

- Supabase helper is cloud-capable even if dormant.

## CANONICAL DATA AUTHORITIES

- Orphan detector: `ai-cto/orphan-telemetry-detector.js`
- Hidden dataflow detector: `ai-cto/hidden-dataflow-detector.js`

## AUDIT CONFIDENCE

MEDIUM. Source-visible telemetry surfaces were found; provider-side logs are unverified.

## RECOMMENDED HARDENING

1. Classify Supabase helper as REMOVE or aggregate-only before privacy-safe claims.
2. Keep founder operational prompts separate from keyboard typed text.
3. Do not add telemetry-like files without registry entries.
