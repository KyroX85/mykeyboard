# Hot Path Optimization Report

## Scope

This pass reduced typing-path risk without changing typing behavior, prediction behavior, routing, haptics, telemetry schema, or lifecycle behavior.

## Changes Made

- Cached `user_id` through `cachedUserId` so repeated telemetry events do not repeatedly call `getSharedPreferences("keyboard_prefs", ...)`.
- Renamed the loader to `loadOrCreateUserId()` to make the one-time persistence boundary explicit.
- Moved Supabase config reads and payload construction fully inside the existing IO coroutine in `logEvent`.
- Preserved the existing telemetry schema and REST endpoint.
- Removed `button.animate().cancel()` from key press, key release, swipe pressed-key transition, and pressed-state cleanup paths.
- Kept direct pressed-state property writes (`isPressed`, scale, translation, elevation) for immediate feedback without ViewPropertyAnimator access.

## Allocations Removed Or Avoided

- Avoided repeated SharedPreferences lookup for user ID after first load.
- Avoided caller-thread JSON/payload construction in `logEvent`.
- Removed ViewPropertyAnimator access from normal key press/release feedback and swipe pressed-key transition.
- Existing haptic path already uses cached vibrator service and cached `VibrationEffect` instances.
- Existing protected hot-path guardrails already block `JSONObject`, network calls, persistence writes, and coroutine launches inside commit/touch methods.

## Main-Thread Work Reduced

- `logEvent` now returns after scheduling IO work; Supabase URL/key reads, JSON creation, request creation, and user ID access occur off the caller thread.
- Typing commit methods continue not to call telemetry directly.
- Key press visual feedback and swipe pressed-key feedback now use direct property assignment only; they no longer touch `View.animate()` on each press/release/transition.

## Expected Latency Improvement

- Direct typing path: small perceived-latency and allocation-risk improvement from removing ViewPropertyAnimator access during press/release.
- Telemetry/reporting path: lower caller-thread risk when metrics logging is re-enabled or invoked from lifecycle/reporting paths.

## Regression Risk

- Severity: LOW.
- Risk: cached user ID means the value is fixed for the service lifetime, which is intended and avoids repeated preference reads.
- Press-state risk: LOW; direct scale/translation reset remains unchanged.
- Telemetry schema risk: none; payload keys are unchanged.

## Rollback Complexity

Low. Replace `cachedUserId` with `loadOrCreateUserId()` inside the payload builder, move config reads back before `scope.launch`, and restore `button.animate().cancel()` calls if a real-device stuck animator regression appears.

## Validation Command

```powershell
.\gradlew.bat --no-daemon clean :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

## Confidence Score

8.5/10. The changes are small and isolated. Remaining hot-path improvements should be driven by profiling, not speculative cleanup.
