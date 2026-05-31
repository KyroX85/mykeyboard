package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class VoiceTypingGuardrailsTest {

    @Test
    fun manifestDeclaresMicrophonePermissionForVoiceTyping() {
        val manifest = sourceFile("app/src/main/AndroidManifest.xml").readText()

        assertTrue(manifest.contains("android.permission.RECORD_AUDIO"))
    }

    @Test
    fun voiceTypingUsesSpeechRecognizerAndSafeCommitPath() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val startVoiceTyping = methodBody(source, "startVoiceTyping")
        val commitVoiceResult = methodBody(source, "commitVoiceResult")
        val permissionSettings = methodBody(source, "openMicrophonePermissionSettings")

        assertTrue(source.contains("SpeechRecognizer"))
        assertTrue(startVoiceTyping.contains("SpeechRecognizer.createSpeechRecognizer(this)"))
        assertTrue(startVoiceTyping.contains("RecognizerIntent.ACTION_RECOGNIZE_SPEECH"))
        assertTrue(startVoiceTyping.contains("RecognizerIntent.EXTRA_PARTIAL_RESULTS, true"))
        assertTrue(startVoiceTyping.contains("openMicrophonePermissionSettings()"))
        assertTrue(permissionSettings.contains("MainActivity.EXTRA_REQUEST_MIC_PERMISSION"))
        assertTrue(permissionSettings.contains("startActivity(intent)"))
        assertTrue(commitVoiceResult.contains("commitTextSafely(ic,"))
        assertFalse(commitVoiceResult.contains(".commitText("))
        assertFalse(startVoiceTyping.contains("logEvent("))
    }

    @Test
    fun voiceTypingIsStoppedDuringImeCleanup() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val cleanup = methodBody(source, "cleanupInputViewState")
        val destroy = methodBody(source, "destroySpeechRecognizer")

        assertTrue(cleanup.contains("stopVoiceTyping(cancel = true)"))
        assertTrue(destroy.contains("speechRecognizer?.destroy()"))
        assertTrue(destroy.contains("speechRecognizer = null"))
    }

    @Test
    fun voiceTypingShowsRecordingStateAndStreamsPartialText() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val listener = methodBody(source, "createSpeechRecognitionListener")
        val partial = methodBody(source, "commitVoicePartial")
        val voiceUi = methodBody(source, "updateVoiceKeyUI")

        assertTrue(listener.contains("override fun onPartialResults"))
        assertTrue(listener.contains("commitVoicePartial"))
        assertTrue(partial.contains("setComposingText"))
        assertTrue(source.contains("voiceRecordingPulse"))
        assertTrue(voiceUi.contains("voiceRecordingPulse"))
        assertTrue(voiceUi.contains("#35D07F"))
    }

    @Test
    fun micKeyUsesExistingKeyboardRoutingOnly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val keyRows = methodBody(source, "keyRowsForMode")
        val suggestionBar = methodBody(source, "setupSuggestionBar")

        assertTrue(source.contains("const val KEY_MIC"))
        assertFalse(keyRows.contains("KEY_MIC"))
        assertTrue(suggestionBar.contains("text = KEY_MIC"))
        assertTrue(source.contains("KEY_MIC -> toggleVoiceTyping()"))
    }

    @Test
    fun launcherOwnsRuntimeMicPermissionRequest() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/MainActivity.kt").readText()

        assertTrue(source.contains("EXTRA_REQUEST_MIC_PERMISSION"))
        assertTrue(source.contains("requestMicrophonePermissionIfNeeded()"))
        assertTrue(source.contains("requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO)"))
    }

    @Test
    fun spacebarCursorControlIsLongPressAndDragOnly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val handleSpaceDown = methodBody(source, "handleSpaceDown")
        val handleSpaceUp = methodBody(source, "handleSpaceUp")
        val updateSpaceCursorDrag = methodBody(source, "updateSpaceCursorDrag")

        assertTrue(source.contains("SPACE_CURSOR_LONG_PRESS_DELAY_MS"))
        assertFalse(handleSpaceDown.contains("commitSpace()"))
        assertTrue(handleSpaceUp.contains("commitSpace()"))
        assertTrue(handleSpaceUp.contains("!spaceCursorModeActive"))
        assertTrue(handleSpaceDown.contains("spaceCursorModeActive = true"))
        assertTrue(updateSpaceCursorDrag.contains("KeyEvent.KEYCODE_DPAD_RIGHT"))
        assertTrue(updateSpaceCursorDrag.contains("KeyEvent.KEYCODE_DPAD_LEFT"))
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
