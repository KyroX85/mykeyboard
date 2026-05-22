package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class InteractionRhythmGuardrailsTest {

    @Test
    fun touchAndLongPressTimingStayResponsiveButBounded() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()

        assertTrue(source.contains("const val TOUCH_SLOP_HORIZONTAL_DP = 20"))
        assertTrue(source.contains("const val TOUCH_SLOP_VERTICAL_DP = 22"))
        assertTrue(source.contains("const val SYMBOL_LONG_PRESS_DELAY_MS = 230L"))
        assertTrue(source.contains("const val SHIFT_LONG_PRESS_DELAY_MS = 300L"))
        assertFalse(source.contains("const val SYMBOL_LONG_PRESS_DELAY_MS = 260L"))
    }

    @Test
    fun previewDismissesWhenPointerLeavesExpandedTarget() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val handleTouch = methodBody(source, "handleTouch")

        assertTrue(handleTouch.contains("val inside = isInsideExpandedTouchTarget"))
        assertTrue(handleTouch.contains("if (!inside)"))
        assertTrue(handleTouch.contains("dismissKeyPreviewSafely()"))
    }

    @Test
    fun swipeTrailInvalidatesOnFrameAndUsesShortFade() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/swipe/SwipeTrailView.kt").readText()
        val addPoint = methodBody(source, "addPoint")

        assertTrue(addPoint.contains("postInvalidateOnAnimation()"))
        assertFalse(addPoint.contains("invalidate()"))
        assertTrue(source.contains("const val FADE_MS = 70L"))
    }

    @Test
    fun swipeTrailUsesBoundedRollingTailForLongGestures() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/swipe/SwipeTrailView.kt").readText()
        val addPoint = methodBody(source, "addPoint")

        assertTrue(source.contains("const val MAX_POINTS = 192"))
        assertTrue(addPoint.contains("rollTail()"))
        assertTrue(addPoint.contains("capHit = true"))
        assertTrue(methodBody(source, "rollTail").contains("xs[index - 1] = xs[index]"))
        assertTrue(methodBody(source, "rollTail").contains("ys[index - 1] = ys[index]"))
    }

    @Test
    fun keyboardPanelDoesNotClipSwipeTrailDuringLongGestures() {
        val source = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText()
        val panelStart = source.indexOf("android:id=\"@+id/keyboardPanel\"")
        assertTrue(panelStart >= 0)
        val panelEnd = source.indexOf("<LinearLayout", panelStart)
        val panelBlock = source.substring(panelStart, panelEnd)

        assertTrue(panelBlock.contains("android:clipChildren=\"false\""))
        assertTrue(panelBlock.contains("android:clipToPadding=\"false\""))
        assertTrue(panelBlock.contains("android:clipToOutline=\"false\""))
    }

    @Test
    fun suggestionsSkipIdenticalRefreshQueries() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val updateSuggestions = methodBody(source, "updateSuggestions")

        assertTrue(updateSuggestions.contains("lastSuggestionQueryPrefix"))
        assertTrue(updateSuggestions.contains("lastSuggestionQueryPreviousWord"))
        assertTrue(updateSuggestions.contains("return"))
        assertTrue(updateSuggestions.indexOf("return") < updateSuggestions.indexOf("predictor.getSuggestions"))
    }

    @Test
    fun backspaceRepeatUsesBoundedSmoothAcceleration() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val startRepeatingDelete = methodBody(source, "startRepeatingDelete")

        assertTrue(source.contains("const val DELETE_REPEAT_INITIAL_DELAY_MS = 285L"))
        assertTrue(source.contains("const val DELETE_REPEAT_START_INTERVAL_MS = 105L"))
        assertTrue(source.contains("const val DELETE_REPEAT_MIN_INTERVAL_MS = 45L"))
        assertTrue(source.contains("const val DELETE_REPEAT_ACCELERATION_MS = 5L"))
        assertTrue(startRepeatingDelete.contains("max(DELETE_REPEAT_MIN_INTERVAL_MS"))
    }

    @Test
    fun hotMovePathStillAvoidsAllocatingObjects() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val handleTouch = methodBody(source, "handleTouch")
        val updateSwipeTracking = methodBody(source, "updateSwipeTracking")
        val forbidden = listOf("mutableListOf", "ArrayList", "StringBuilder", "JSONObject", "MotionEvent.obtain")

        for (token in forbidden) {
            assertFalse("handleTouch must not contain $token", handleTouch.contains(token))
            assertFalse("updateSwipeTracking must not contain $token", updateSwipeTracking.contains(token))
        }
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
