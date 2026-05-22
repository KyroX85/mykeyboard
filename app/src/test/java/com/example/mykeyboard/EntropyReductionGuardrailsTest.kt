package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class EntropyReductionGuardrailsTest {

    @Test
    fun actionCancelConvergesOnLifecycleCleanupInsteadOfDuplicatingResetLogic() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val handleTouch = methodBody(source, "handleTouch")
        val cancelBranch = branchBody(handleTouch, "MotionEvent.ACTION_CANCEL")

        assertTrue(cancelBranch.contains("cleanupInputViewState()"))
        assertFalse(cancelBranch.contains("cancelSwipeGesture()"))
        assertFalse(cancelBranch.contains("dismissKeyPreviewSafely()"))
        assertFalse(cancelBranch.contains("stopRepeatingDelete()"))
        assertFalse(cancelBranch.contains("stopRepeatingSpace()"))
    }

    @Test
    fun routedTouchOwnershipClearsThroughSingleHelper() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val cleanup = methodBody(source, "cleanupInputViewState")
        val rowTouch = methodBody(source, "handleRowTouch")
        val clearOwner = methodBody(source, "clearRoutedTouchOwner")

        assertTrue(cleanup.contains("clearRoutedTouchOwner()"))
        assertTrue(rowTouch.contains("clearRoutedTouchOwner()"))
        assertTrue(clearOwner.contains("routedTouchButton = null"))
        assertTrue(clearOwner.contains("routedTouchKey = null"))
    }

    @Test
    fun nonSwipeKeysUseSwipeCancellationBoundary() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val startSwipe = methodBody(source, "startSwipeTrackingIfEligible")
        val ineligibleBranch = startSwipe.substringBefore("return")

        assertTrue(ineligibleBranch.contains("cancelSwipeGesture()"))
        assertFalse(ineligibleBranch.contains("swipeTracker.cancel()"))
        assertFalse(ineligibleBranch.contains("swipeTrailView.resetNow()"))
    }

    @Test
    fun debugSwipeReportsRemainBehindSingleGate() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val commitSwipe = methodBody(source, "commitSwipeSequence")

        assertTrue(commitSwipe.contains("isDebugLoggingEnabled()"))
        assertTrue(commitSwipe.contains("debugReporter"))
        assertFalse(commitSwipe.substringBefore("isDebugLoggingEnabled()").contains("Log.d(SWIPE_DEBUG_TAG"))
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

    private fun branchBody(methodBody: String, branchLabel: String): String {
        val start = methodBody.indexOf(branchLabel)
        require(start >= 0) { "Missing branch $branchLabel" }
        val openBrace = methodBody.indexOf('{', start)
        require(openBrace >= 0) { "Missing branch body for $branchLabel" }

        var depth = 0
        for (index in openBrace until methodBody.length) {
            when (methodBody[index]) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return methodBody.substring(openBrace + 1, index)
                }
            }
        }
        error("Unterminated branch $branchLabel")
    }
}
