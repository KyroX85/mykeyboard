package com.example.mykeyboard.personal

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PersonalJarvisIsolationGuardrailsTest {
    @Test
    fun personalJarvisIsIsolatedAndRemovable() {
        val manifest = sourceFile("app/src/main/AndroidManifest.xml").readText()
        val buildGradle = sourceFile("app/build.gradle.kts").readText()
        val keyboardService = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()

        assertTrue(buildGradle.contains("PERSONAL_JARVIS_ENABLED"))
        assertTrue(manifest.contains(".personal.JarvisNotificationListenerService"))
        assertTrue(manifest.contains("android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"))
        assertTrue(manifest.contains(".personal.JarvisReminderReceiver"))
        assertFalse(keyboardService.contains("JarvisNotificationListenerService"))
        assertFalse(keyboardService.contains("JarvisReleaseDetector"))
    }

    @Test
    fun personalJarvisDoesNotUseCloudOrAccessibilityControl() {
        val personalSources = sourceFiles("app/src/main/java/com/example/mykeyboard/personal")
            .joinToString("\n") { it.readText() }
        val manifest = sourceFile("app/src/main/AndroidManifest.xml").readText()

        assertFalse(personalSources.contains("Supabase"))
        assertFalse(personalSources.contains("http://"))
        assertFalse(personalSources.contains("https://"))
        assertFalse(personalSources.contains("AccessibilityService"))
        assertFalse(manifest.contains("android.permission.BIND_ACCESSIBILITY_SERVICE"))
    }

    @Test
    fun personalJarvisDelegatesQuestionsToFounderBrainOnly() {
        val connector = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisBrainConnector.kt").readText()
        val listener = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisNotificationListenerService.kt").readText()
        val personalSources = sourceFiles("app/src/main/java/com/example/mykeyboard/personal")
            .joinToString("\n") { it.readText() }

        assertTrue(connector.contains("founderBrainQuestionEndpoint()"))
        assertTrue(connector.contains("Authorization"))
        assertTrue(connector.contains("voiceSummary"))
        assertTrue(listener.contains("JarvisQuestionDetector.extractQuestion"))
        assertTrue(listener.contains("JarvisBrainSpeechPolicy.speechFor(answer)"))
        assertTrue(listener.contains("speaker.speak(spoken)"))
        assertFalse(listener.contains("answer.voiceSummary.ifBlank { answer.summary }"))
        assertFalse(personalSources.contains("routeMessageWithAi"))
        assertFalse(personalSources.contains("answerFounderBrainQuestion"))
        assertFalse(personalSources.contains(".brain_state.json"))
        assertFalse(personalSources.contains("rawReasoning"))
    }

    @Test
    fun wakeWordServiceDelegatesOneCommandToFounderBrainVoiceSummary() {
        val wakeService = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisWakeWordService.kt").readText()
        val connector = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisBrainConnector.kt").readText()
        val speechPolicy = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisBrainSpeechPolicy.kt").readText()
        val speaker = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisSpeaker.kt").readText()

        assertTrue(wakeService.contains("ListeningMode.COMMAND"))
        assertTrue(wakeService.contains("JarvisVoiceSession"))
        assertTrue(wakeService.contains("activeSession != null"))
        assertTrue(wakeService.contains("WAKE_DEBOUNCE_MS"))
        assertTrue(wakeService.contains("handleCommandResults"))
        assertTrue(wakeService.contains("askFounderBrain(session, question)"))
        assertTrue(wakeService.contains("sessionId = session.id"))
        assertTrue(wakeService.contains("!connector.isReady()"))
        assertTrue(wakeService.contains("activeSession?.id != session.id"))
        assertTrue(wakeService.contains("releaseSession("))
        assertTrue(wakeService.contains("JarvisBrainSpeechPolicy.speechFor(answer)"))
        assertTrue(wakeService.contains("speaker?.speak(speech)"))
        assertTrue(wakeService.contains("mainHandler.removeCallbacks(restartListeningRunnable)"))
        val restartListening = wakeService.substringAfter("private fun restartListening")
            .substringBefore("private fun ensureRecognizer")
        assertFalse(restartListening.contains("removeCallbacksAndMessages(null)"))
        assertFalse(wakeService.contains("speaker?.speak(answer.summary)"))
        assertTrue(connector.contains("voiceSummary = json.optString(\"voiceSummary\")"))
        assertTrue(connector.contains(".put(\"sessionId\", sessionId)"))
        assertTrue(connector.contains(".addHeader(\"X-Aritenis-Session-Id\", sessionId)"))
        assertTrue(connector.contains("fun isReady()"))
        assertTrue(speechPolicy.contains("answer.voiceSummary.trim()"))
        assertFalse(speechPolicy.contains("answer.summary"))
        assertTrue(speaker.contains("@Synchronized"))
        assertTrue(speaker.contains("engine.stop()"))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }

    private fun sourceFiles(relativePath: String): List<File> {
        val dir = sourceFile(relativePath)
        return dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
    }
}
