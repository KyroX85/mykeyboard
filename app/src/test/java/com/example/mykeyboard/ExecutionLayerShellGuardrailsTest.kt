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
        assertTrue(source.contains("What do you want done?"))
        assertTrue(source.contains("lightBlueGlassDrawable"))
        assertFalse(source.contains("DeviceFileFinder"))
        assertFalse(source.contains("FileSearchMatcher"))
        assertFalse(manifest.contains("READ_EXTERNAL_STORAGE"))
        assertFalse(manifest.contains("READ_MEDIA_IMAGES"))
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
