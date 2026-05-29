# PRIVACY_SURFACE_TOPOLOGY

Generated: 2026-05-29

## VISIBLE SYSTEMS

| Surface | Classification | Authority |
|---|---:|---|
| Android runtime keyboard | ACTIVE RISK local | `KeyboardService.kt` |
| Predictor SharedPreferences | ACTIVE RISK local | `BasicPredictor.kt` |
| Runtime aggregate metrics | SAFE | `KeyboardMetrics.kt` |
| Local product ingestion | SAFE | `product-metrics-ingest.js` |
| Product evidence archive | SAFE | `product-evidence-archive.json` |
| Product Lab screenshots | THEORETICAL RISK | `ai-cto/product-lab` |
| WhatsApp operational memory | ACTIVE RISK operational | `whatsapp-server.js` |
| Supabase helper | DANGEROUS | `KeyboardService.kt` |
| Backup rules | HARDENED THIS PHASE | `res/xml` |

## INVISIBLE / PARTIAL SYSTEMS

- `ai-cto/datasets/` absent in current checkout.
- Historical remote artifacts unverified.

## UNVERIFIED PATHS

- Provider dashboards/logs.
- Installed-device old data.

## THEORETICAL EXPORT RISKS

- Supabase generic helper.
- Screenshots on real devices.
- Workflow artifact upload.

## ACTIVE RISKS

- Local predictor raw-word persistence.
- Founder operational message memory.

## DEAD CODE RISKS

- Dormant cloud helper.

## CANONICAL DATA AUTHORITIES

- `canonical-dataflow-authority.js`
- `privacy-surface-mapper.js`

## AUDIT CONFIDENCE

MEDIUM-HIGH.

## RECOMMENDED HARDENING

1. Remove Supabase helper or strict allowlist it.
2. Keep SharedPreferences excluded from backup.
3. Register future datasets before write paths exist.
