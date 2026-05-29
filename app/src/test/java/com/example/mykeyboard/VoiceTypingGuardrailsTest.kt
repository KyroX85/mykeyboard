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

        assertTrue(source.contains("SpeechRecognizer"))
        assertTrue(startVoiceTyping.contains("SpeechRecognizer.createSpeechRecognizer(this)"))
        assertTrue(startVoiceTyping.contains("RecognizerIntent.ACTION_RECOGNIZE_SPEECH"))
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
    fun micKeyUsesExistingKeyboardRoutingOnly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val keyRows = methodBody(source, "keyRowsForMode")

        assertTrue(source.contains("const val KEY_MIC"))
        assertTrue(keyRows.contains("KEY_MIC"))
        assertTrue(source.contains("KEY_MIC -> toggleVoiceTyping()"))
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
