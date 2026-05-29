# CANONICAL_PRIVACY_BOUNDARY_REPORT

Generated: 2026-05-29

## VISIBLE SYSTEMS

- Canonical registry: `ai-cto/canonical-privacy-registry.js`
- Runtime metrics: `KeyboardMetrics.kt`, `ProductSignalBridge.kt`
- Local predictor persistence: `BasicPredictor.kt`
- WhatsApp operations: `ai-cto/whatsapp-server.js`, `ai-cto/whatsapp/`
- Product Lab screenshots/reports: `ai-cto/product-lab/`
- GitHub Actions artifacts: `.github/workflows/`
- Backup rules: `backup_rules.xml`, `data_extraction_rules.xml`

## INVISIBLE / PARTIAL SYSTEMS

- No tracked `ai-cto/datasets/` directory exists in this checkout.
- Historical GitHub Actions artifacts are external.
- Supabase dashboard/table history is external.

## UNVERIFIED PATHS

- Provider retention for Twilio, Meta, NVIDIA, Firebase, Supabase, and Render.
- Git history before the current working tree.

## THEORETICAL EXPORT RISKS

- Supabase helper can upload arbitrary future payloads.
- Product Lab screenshots can leak content if run on a real personal device.
- Generated reports/artifacts can upload whatever future code writes into artifact paths.

## ACTIVE RISKS

- `BasicPredictor` stores learned typed words locally.
- Founder WhatsApp commands are operational text and may enter memory/provider paths.

## DEAD CODE RISKS

- `ai-cto/datasets/` is absent, but its absence must be checked by the canonical registry every audit.
- Dormant Supabase logging remains dangerous until removed or allowlisted.

## CANONICAL DATA AUTHORITIES

- Privacy registry: `ai-cto/canonical-privacy-registry.js`
- Dataflow authority: `ai-cto/canonical-dataflow-authority.js`
- Runtime aggregate authority: `ProductSignalBridge.kt`
- Evidence authority: `ai-cto/product-evidence-archive.json`

## AUDIT CONFIDENCE

MEDIUM-HIGH. The current tree is visible, but remote/provider history is not locally verifiable.

## RECOMMENDED HARDENING

1. Route every future privacy report through `discoverPrivacySurfaces()`.
2. Remove or strictly allowlist Supabase runtime logging.
3. Keep backup exclusions for `keyboard_predictions.xml` and `keyboard_prefs.xml`.
4. Treat missing dataset folders as a verified state, not an assumption.
