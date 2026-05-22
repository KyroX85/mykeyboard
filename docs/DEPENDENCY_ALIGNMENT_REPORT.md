# Dependency Alignment Report

## Scope

This pass checked `app/build.gradle.kts` for duplicate or conflicting dependency families without mutating workflows or introducing new libraries.

## Build Integrity Findings

- `R.getDrawable.key_bg` is not present.
- `resources.getDrawable(R.getDrawable...)` is not present.
- Keyboard drawables use `R.drawable.key_bg` style resource IDs.
- Existing guardrail `generatedResourceReferencesUseDrawableIdsOnly()` protects this regression.

## Dependency Families Checked

| Family | Final declaration | Status |
| --- | --- | --- |
| OkHttp | `com.squareup.okhttp3:okhttp:4.12.0` | Single version |
| AndroidX core-ktx | `libs.androidx.core.ktx` | Single declaration |
| Supabase core | `io.github.jan-tennert.supabase:supabase-kt:2.5.0` | Single version family |
| Supabase postgrest | `io.github.jan-tennert.supabase:postgrest-kt:2.5.0` | Aligned |
| Supabase realtime | `io.github.jan-tennert.supabase:realtime-kt:2.5.0` | Aligned |
| Supabase gotrue | `io.github.jan-tennert.supabase:gotrue-kt:2.5.0` | Aligned |

## Removed Duplicates

None in this pass. The app module already has one OkHttp declaration, one core-ktx declaration, and one Supabase version family.

## Final Dependency Graph Summary

- Android app/plugin stack remains unchanged.
- Compose dependencies remain because `MainActivity.kt` uses Compose.
- OkHttp remains because `KeyboardService` uses direct REST logging.
- `org.json` remains because predictor persistence and telemetry payload construction use `JSONObject`.
- Supabase artifacts remain aligned to `2.5.0`.

## Risk Assessment

- Regression severity: LOW.
- Runtime risk: none; no dependency behavior changed.
- Build risk: none; no dependency coordinates changed.
- Security/privacy risk: unchanged.

## Rollback Instructions

No dependency rollback is required because no dependency changes were made. If future alignment changes are needed, revert only the specific dependency coordinate edits in `app/build.gradle.kts` and rerun:

```powershell
.\gradlew.bat --no-daemon clean :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

## Confidence Score

9/10. The dependency declarations are directly inspectable and existing tests already enforce single-version OkHttp, Supabase, and Postgrest declarations.
