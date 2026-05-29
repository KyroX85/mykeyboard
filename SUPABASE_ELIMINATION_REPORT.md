# SUPABASE_ELIMINATION_REPORT

Generated: 2026-05-29

## VISIBLE SYSTEMS

- `ARITENIS_SUPABASE_URL` and `ARITENIS_SUPABASE_ANON_KEY` are injected into `BuildConfig`.
- `KeyboardService.logEvent()` can POST to `/rest/v1/typing_logs`.
- No Supabase SDK dependency exists.
- `logMetricSnapshot()` has no current caller found.

## INVISIBLE / PARTIAL SYSTEMS

- Supabase dashboard rows, RLS, retention, and logs.

## UNVERIFIED PATHS

- Historical Supabase rows from older builds.
- CI secret values.

## THEORETICAL EXPORT RISKS

- Generic `Pair<String, Any>` payload can serialize future raw text.

## ACTIVE RISKS

- Cloud-capable helper exists inside keyboard runtime source.

## DEAD CODE RISKS

- Dormant cloud code is one call away from becoming active telemetry.

## CANONICAL DATA AUTHORITIES

- `canonical-privacy-registry.js` classifies Supabase as `DANGEROUS`.
- `SUPABASE_AUDIT_REPORT.md` documents prior risk evidence.

## AUDIT CONFIDENCE

HIGH for local source. LOW for remote Supabase table history.

## RECOMMENDED HARDENING

1. Preferred: remove Supabase runtime logging entirely from IME code.
2. Acceptable fallback: replace `logEvent()` with aggregate-only allowlisted DTO and tests.
3. Remove Supabase secrets from Android build workflows if not needed.
4. Do not claim hard local-first privacy while generic Supabase runtime helper remains.
