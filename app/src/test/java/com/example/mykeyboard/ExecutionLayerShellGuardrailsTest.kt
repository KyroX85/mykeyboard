package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ExecutionLayerShellGuardrailsTest {

    @Test
    fun executionLayerShellIsHandleActivatedWithoutFeatureBackend() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val manifest = sourceFile("app/src/main/AndroidManifest.xml").readText()

        assertTrue(source.contains("setupExecutionLayerShell()"))
        assertTrue(source.contains("EXECUTION_HANDLE_PULL_THRESHOLD_DP"))
        assertTrue(source.contains("How can I help?"))
        assertTrue(source.contains("Tell Aritenis..."))
        assertTrue(source.contains("Speak naturally. Aritenis listens, understands, then acts."))
        assertTrue(source.contains("lightBlueGlassDrawable"))
        assertTrue(manifest.contains("android.permission.SYSTEM_ALERT_WINDOW"))
        assertFalse(source.contains("DeviceFileFinder"))
        assertFalse(source.contains("FileSearchMatcher"))
        assertFalse(manifest.contains("READ_EXTERNAL_STORAGE"))
        assertFalse(manifest.contains("READ_MEDIA_IMAGES"))
    }

    @Test
    fun executionLayerIsVoiceFirstNotDashboardFirst() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val setup = methodBody(source, "setupExecutionLayerShell")
        val overlay = methodBody(source, "showFullScreenExecutionOverlay")

        assertTrue(setup.contains("KEY_MIC"))
        assertTrue(overlay.contains("KEY_MIC"))
        assertTrue(setup.indexOf("KEY_MIC") < setup.indexOf("Tell Aritenis..."))
        assertTrue(overlay.indexOf("KEY_MIC") < overlay.indexOf("Tell Aritenis..."))
        assertFalse(setup.contains("Find"))
        assertFalse(setup.contains("Check"))
        assertFalse(setup.contains("Send"))
        assertFalse(setup.contains("Make"))
        assertFalse(overlay.contains("Find"))
        assertFalse(overlay.contains("Check"))
        assertFalse(overlay.contains("Send"))
        assertFalse(overlay.contains("Make"))
        assertFalse(source.contains("Speak: Open Instagram"))
    }

    @Test
    fun executionCommandUsesExistingKeyboardOnlyWhileLayerIsOpen() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val down = methodBody(source, "handleKeyDown")
        val up = methodBody(source, "handleKeyUp")
        val commandDown = methodBody(source, "handleExecutionCommandKeyDown")
        val commandUp = methodBody(source, "handleExecutionCommandKeyUp")

        assertTrue(down.contains("if (executionLayerOpen)"))
        assertTrue(up.contains("if (executionLayerOpen)"))
        assertTrue(commandDown.contains("deleteExecutionCommandCharacter()"))
        assertTrue(commandUp.contains("appendExecutionCommand"))
        assertFalse(commandDown.contains("commitTextSafely"))
        assertFalse(commandUp.contains("commitTextSafely"))
    }

    @Test
    fun executionLayerDoesNotTouchPredictionOrSupabase() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val setup = methodBody(source, "setupExecutionLayerShell")
        val open = methodBody(source, "openExecutionLayer")

        assertFalse(setup.contains("predictor"))
        assertFalse(setup.contains("logEvent("))
        assertFalse(open.contains("predictor"))
        assertFalse(open.contains("logEvent("))
    }

    @Test
    fun executionOverlayRequiresPermissionAndIsLifecycleCleaned() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val open = methodBody(source, "openExecutionLayer")
        val showOverlay = methodBody(source, "showFullScreenExecutionOverlay")
        val close = methodBody(source, "closeExecutionLayer")
        val cleanup = methodBody(source, "cleanupInputViewState")
        val destroy = methodBody(source, "onDestroy")

        assertTrue(source.contains("WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY"))
        assertTrue(source.contains("Settings.ACTION_MANAGE_OVERLAY_PERMISSION"))
        assertTrue(open.contains("canDrawExecutionOverlay()"))
        assertTrue(open.contains("showFullScreenExecutionOverlay()"))
        assertTrue(showOverlay.contains("WindowManager.LayoutParams.MATCH_PARENT"))
        assertTrue(showOverlay.contains("WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE"))
        assertTrue(close.contains("removeView"))
        assertTrue(cleanup.contains("closeExecutionLayer()"))
        assertTrue(destroy.contains("cleanupInputViewState()"))
    }

    @Test
    fun founderExecutionLayerLaunchesAppsOnlyThroughLocalVoiceIntent() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val manifest = sourceFile("app/src/main/AndroidManifest.xml").readText()
        val voice = methodBody(source, "startExecutionVoiceCommand")
        val detection = methodBody(source, "detectExecutionLaunchIntent")
        val resolution = methodBody(source, "resolveLaunchableApp")
        val launch = methodBody(source, "launchExecutionApp")

        assertTrue(manifest.contains("android.intent.action.MAIN"))
        assertTrue(manifest.contains("android.intent.category.LAUNCHER"))
        assertTrue(source.contains("EXECUTION_APP_ALIASES"))
        assertTrue(source.contains("com.instagram.android"))
        assertTrue(source.contains("com.whatsapp"))
        assertTrue(source.contains("com.android.chrome"))
        assertTrue(source.contains("net.one97.paytm"))
        assertTrue(source.contains("com.phonepe.app"))
        assertTrue(voice.contains("RecognizerIntent.ACTION_RECOGNIZE_SPEECH"))
        assertTrue(detection.contains("open "))
        assertTrue(resolution.contains("packageManager.queryIntentActivities"))
        assertTrue(launch.contains("startActivity"))
        assertFalse(launch.contains("sendText"))
        assertFalse(voice.contains("newCall("))
        assertFalse(detection.contains("newCall("))
        assertFalse(resolution.contains("newCall("))
        assertFalse(launch.contains("newCall("))
        assertFalse(voice.contains("Supabase"))
        assertFalse(detection.contains("Supabase"))
        assertFalse(resolution.contains("Supabase"))
        assertFalse(launch.contains("Supabase"))
        assertFalse(source.contains("AccessibilityService"))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }

    private fun methodBody(source: String, methodName: String): String {
        val start = source.indexOf("fun $methodName")
        require(start >= 0) { "Missing method $methodName" }
        val openBrace = source.indexOf('{', start)
        require(openBrace >= 0) { "Missing method body for $methodName" }

        var depth = 0
        for (index in openBrace until source.length) {
            when (source[index]) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return source.substring(openBrace + 1, index)
                }
            }
        }
        error("Unterminated method body for $methodName")
    }
}
