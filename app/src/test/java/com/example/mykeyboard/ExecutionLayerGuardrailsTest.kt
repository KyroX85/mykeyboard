package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ExecutionLayerGuardrailsTest {

    @Test
    fun executionLayerIsPullHandleActivatedAndNotTypingShortcutActivated() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()

        assertTrue(source.contains("setupExecutionLayer()"))
        assertTrue(source.contains("EXECUTION_HANDLE_PULL_THRESHOLD_DP"))
        assertTrue(source.contains("openExecutionLayer()"))
        assertFalse(source.contains("doubleTapSpace"))
        assertFalse(source.contains("twoFinger"))
    }

    @Test
    fun executionLayerDoesNotUsePredictionOrSupabaseForFileSearch() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val searchBody = methodBody(source, "submitExecutionSearch")

        assertTrue(searchBody.contains("deviceFileFinder.search"))
        assertFalse(searchBody.contains("predictor."))
        assertFalse(searchBody.contains("logEvent("))
        assertFalse(searchBody.contains("supabase"))
    }

    @Test
    fun fileFinderKeepsSearchLocalAndMetadataOnly() {
        val finder = sourceFile("app/src/main/java/com/example/mykeyboard/execution/DeviceFileFinder.kt").readText()

        assertTrue(finder.contains("MediaStore"))
        assertFalse(finder.contains("OkHttp"))
        assertFalse(finder.contains("SUPABASE"))
        assertFalse(finder.contains("openInputStream"))
        assertFalse(finder.contains("readBytes"))
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
