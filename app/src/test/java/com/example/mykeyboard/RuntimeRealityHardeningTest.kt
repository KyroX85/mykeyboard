package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class RuntimeRealityHardeningTest {

    @Test
    fun startInputPathsCleanTransientRuntimeStateBeforeEditorReuse() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val onStartInput = methodBody(source, "onStartInput")
        val onStartInputView = methodBody(source, "onStartInputView")

        assertTrue(onStartInput.indexOf("cleanupInputViewState()") < onStartInput.indexOf("updateImeAction"))
        assertTrue(onStartInputView.indexOf("cleanupInputViewState()") < onStartInputView.indexOf("updateImeAction"))
    }

    @Test
    fun cleanupReleasesPressedKeyStateBeforeDroppingTouchOwnership() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val cleanup = methodBody(source, "cleanupInputViewState")
        val clearPressed = methodBody(source, "clearPressedKeyStates")
        val applyPress = methodBody(source, "applyKeyPressFeedback")
        val releasePress = methodBody(source, "releaseKeyPressFeedback")

        assertTrue(cleanup.indexOf("clearPressedKeyStates()") < cleanup.indexOf("clearRoutedTouchOwner()"))
        assertFalse(applyPress.contains("animate()"))
        assertFalse(releasePress.contains("animate()"))
        assertFalse(clearPressed.contains("animate()"))
        assertTrue(clearPressed.contains("isPressed = false"))
        assertTrue(clearPressed.contains("scaleX = 1f"))
        assertTrue(clearPressed.contains("translationY = 0f"))
    }

    @Test
    fun commitTextCallsAreContainedBehindRuntimeSafeHelper() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val directCommitAllowed = setOf("commitTextSafely")
        val methodsToCheck = listOf(
            "acceptSuggestion",
            "commitLongPressSymbol",
            "commitSpace",
            "commitEnter",
            "handleImeActionKey",
            "commitAutocorrectionIfNeeded",
            "commitTextKey",
            "commitSwipeSequence"
        )

        for (method in methodsToCheck) {
            if (method in directCommitAllowed) continue
            val body = methodBody(source, method)
            assertFalse("$method must not call commitText directly", body.contains(".commitText("))
        }

        val helper = methodBody(source, "commitTextSafely")
        assertTrue(helper.contains("try"))
        assertTrue(helper.contains("catch (e: RuntimeException)"))
        assertTrue(helper.contains("Log.w"))
    }

    @Test
    fun cleanupAvoidsSuggestionRefreshAndPersistenceWork() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val cleanup = methodBody(source, "cleanupInputViewState")

        assertFalse(cleanup.contains("updateSuggestions"))
        assertFalse(cleanup.contains("predictor."))
        assertFalse(cleanup.contains("commitText"))
        assertFalse(cleanup.contains("logEvent("))
    }

    @Test
    fun cleanupDisposesPreviewPopupReferencesAcrossInputViewRecreation() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val cleanup = methodBody(source, "cleanupInputViewState")
        val disposePreview = methodBody(source, "disposeKeyPreviewReferences")

        assertTrue(cleanup.contains("disposeKeyPreviewReferences()"))
        assertTrue(disposePreview.contains("dismissKeyPreviewSafely()"))
        assertTrue(disposePreview.contains("keyPreviewPopup = null"))
        assertTrue(disposePreview.contains("keyPreviewText = null"))
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
