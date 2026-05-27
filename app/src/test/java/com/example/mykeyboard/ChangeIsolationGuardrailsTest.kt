package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ChangeIsolationGuardrailsTest {

    @Test
    fun longpressSymbolUsesSwipeAndPreviewBoundariesInsteadOfMutatingOwnersDirectly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val body = methodBody(source, "commitLongPressSymbol")

        assertTrue(body.indexOf("cancelSwipeGesture()") in 0 until body.indexOf("commitTextSafely"))
        assertTrue(body.indexOf("dismissKeyPreviewSafely()") in 0 until body.indexOf("commitTextSafely"))
        assertFalse(body.contains("swipeTrackingStarted = false"))
        assertFalse(body.contains("swipeTracker.cancel()"))
        assertFalse(body.contains("swipeTrailView.resetNow()"))
    }

    @Test
    fun onlyCanonicalHelpersOwnTransientStateMutation() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val allowed = mapOf(
            "swipeTrackingStarted = false" to setOf("cancelSwipeGesture", "finishSwipeGesture"),
            "swipeTracker.cancel()" to setOf("cancelSwipeGesture"),
            "routedTouchButton = null" to setOf("clearRoutedTouchOwner"),
            "routedTouchKey = null" to setOf("clearRoutedTouchOwner"),
            "keyPreviewPopup = null" to setOf("disposeKeyPreviewReferences"),
            "keyPreviewText = null" to setOf("disposeKeyPreviewReferences"),
            "activePopup = null" to setOf("dismissActivePopupSafely")
        )

        for ((mutation, owners) in allowed) {
            val actualOwners = methodNamesContaining(source, mutation)
            assertTrue(
                "$mutation owners were $actualOwners, expected only $owners",
                actualOwners.isNotEmpty() && actualOwners.all { it in owners }
            )
        }
    }

    @Test
    fun protectedHotPathZonesRejectExpensiveFeatureWork() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val protectedMethods = listOf(
            "handleTouch",
            "updateSwipeTracking",
            "finishSwipeGesture",
            "commitLongPressSymbol",
            "commitTextKey",
            "commitSwipeSequence",
            "commitSpace",
            "commitEnter",
            "updateSuggestions"
        )
        val forbidden = listOf(
            "JSONObject",
            "newCall(",
            ".execute()",
            "scope.launch",
            "getSharedPreferences(",
            ".edit()",
            "layoutInflater.inflate",
            "Bitmap",
            "Thread.sleep",
            "runBlocking",
            "Log.i("
        )

        for (method in protectedMethods) {
            val body = methodBody(source, method)
            val methodForbidden = if (method == "commitSwipeSequence") {
                forbidden - "scope.launch"
            } else {
                forbidden
            }
            for (token in methodForbidden) {
                assertFalse("$method must not contain $token", body.contains(token))
            }
        }
    }

    @Test
    fun featureCodeCannotBypassCommitSafetyOrCleanupConvergence() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val methodsWithDirectCommit = methodNamesContaining(source, ".commitText(")

        assertTrue(methodsWithDirectCommit == setOf("commitTextSafely"))
        assertTrue(methodBody(source, "handleTouch").contains("cleanupInputViewState()"))
        assertTrue(methodBody(source, "onStartInput").contains("cleanupInputViewState()"))
        assertTrue(methodBody(source, "onStartInputView").contains("cleanupInputViewState()"))
        assertTrue(methodBody(source, "onFinishInput").contains("cleanupInputViewState()"))
        assertTrue(methodBody(source, "onFinishInputView").contains("cleanupInputViewState()"))
        assertTrue(methodBody(source, "onWindowHidden").contains("cleanupInputViewState()"))
        assertTrue(methodBody(source, "onDestroy").contains("cleanupInputViewState()"))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }

    private fun methodNamesContaining(source: String, token: String): Set<String> {
        val regex = Regex("""(?:private\s+)?(?:override\s+)?fun\s+([A-Za-z0-9_]+)\s*\(""")
        val matches = regex.findAll(source).toList()
        val names = linkedSetOf<String>()
        for (index in matches.indices) {
            val start = matches[index].range.first
            val end = matches.getOrNull(index + 1)?.range?.first ?: source.length
            if (source.substring(start, end).contains(token)) {
                names.add(matches[index].groupValues[1])
            }
        }
        return names
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
