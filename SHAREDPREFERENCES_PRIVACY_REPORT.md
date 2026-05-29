# SHAREDPREFERENCES_PRIVACY_REPORT

Generated: 2026-05-29

## VISIBLE SYSTEMS

- `keyboard_predictions` SharedPreferences from `BasicPredictor.kt`.
- `keyboard_prefs` SharedPreferences from `KeyboardService.kt`.
- Backup and data extraction rules.

## INVISIBLE / PARTIAL SYSTEMS

- Actual device backup state cannot be proven from source.

## UNVERIFIED PATHS

- OEM backup behavior.
- Existing installed app data from older builds.

## THEORETICAL EXPORT RISKS

- Before this phase, backup rules were sample placeholders and did not explicitly exclude predictor prefs.

## ACTIVE RISKS

- `keyboard_predictions` stores raw learned words in `predictor_model_v2` and legacy `bigram_model`.
- Retention lasts until `clearModel()`, app data clear, uninstall, or model corruption cleanup.
- Maximum serialized model length is 120,000 chars; model row limits are bounded.

## DEAD CODE RISKS

- Legacy `bigram_model` remains updated for compatibility and must stay excluded from backup.

## CANONICAL DATA AUTHORITIES

- Predictor storage: `BasicPredictor.kt`
- Backup policy: `backup_rules.xml`, `data_extraction_rules.xml`
- Audit function: `sharedPreferencesAudit()`

## AUDIT CONFIDENCE

HIGH for source behavior. MEDIUM for existing installed data state.

## RECOMMENDED HARDENING

1. Done: exclude `keyboard_predictions.xml` and `keyboard_prefs.xml` from cloud backup and device transfer.
2. Add a product-approved private learning toggle.
3. Add a visible reset-learning action later.
4. Consider hashing/encrypting persisted predictor words.
