package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ArchitectureGuardrailsTest {

    @Test
    fun typingTelemetryIsNotCalledFromWordCommitPath() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()

        assertFalse(methodBody(source, "logWord").contains("logEvent("))
        assertFalse(methodBody(source, "maybeFlushMetrics").contains("logMetricSnapshot("))
    }

    @Test
    fun predictorPersistenceIsDebouncedAndNotCancelledPerLearnedWord() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt").readText()
        val scheduleSaveModel = methodBody(source, "scheduleSaveModel")

        assertTrue(scheduleSaveModel.contains("delay(SAVE_DEBOUNCE_MS)"))
        assertFalse(scheduleSaveModel.contains("saveJob?.cancel()"))
        assertTrue(scheduleSaveModel.indexOf("delay(SAVE_DEBOUNCE_MS)") < scheduleSaveModel.indexOf("saveModel()"))
    }

    @Test
    fun swipeMovePathStaysAllocationLight() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt").readText()
        val move = methodBody(source, "move")

        assertFalse(move.contains("ArrayList"))
        assertFalse(move.contains("mutableListOf"))
        assertFalse(move.contains("StringBuilder"))
        assertFalse(move.contains(".toList("))
    }

    @Test
    fun swipeDebugScoresAreDebugBuildGated() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val commitSwipeSequence = methodBody(source, "commitSwipeSequence")

        assertTrue(commitSwipeSequence.contains("isDebugLoggingEnabled()"))
        assertTrue(commitSwipeSequence.contains("Log.d(SWIPE_DEBUG_TAG"))
    }

    @Test
    fun productIntelligenceSignalsStayOutOfCloudTelemetryPayloads() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val logMetricSnapshot = methodBody(source, "logMetricSnapshot")

        assertFalse(logMetricSnapshot.contains("swipe_attempts"))
        assertFalse(logMetricSnapshot.contains("symbol_layer_dependency_percent"))
        assertFalse(logMetricSnapshot.contains("frame_hitch_suspicions"))
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
                    if (depth == 0) {
                        return source.substring(openBrace + 1, index)
                    }
                }
            }
        }
        error("Unterminated method body for $methodName")
    }
}
