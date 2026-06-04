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
        assertTrue(manifest.contains("android:name=\".AritenisApplication\""))
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
        assertFalse(personalSources.contains("https://api."))
        assertFalse(personalSources.contains("https://supabase"))
        assertFalse(personalSources.contains("https://openai"))
        assertFalse(personalSources.contains("AccessibilityService"))
        assertFalse(manifest.contains("android.permission.BIND_ACCESSIBILITY_SERVICE"))
    }

    @Test
    fun personalJarvisDelegatesQuestionsToFounderBrainOnly() {
        val connector = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisBrainConnector.kt").readText()
        val listener = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisNotificationListenerService.kt").readText()
        val runtime = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisBrainRuntime.kt").readText()
        val personalSources = sourceFiles("app/src/main/java/com/example/mykeyboard/personal")
            .joinToString("\n") { it.readText() }

        assertTrue(connector.contains("founderBrainQuestionEndpoint()"))
        assertTrue(connector.contains("Authorization"))
        assertTrue(connector.contains("voiceSummary"))
        assertTrue(connector.contains("executionIntent"))
        assertTrue(connector.contains("fallbackMessage"))
        assertTrue(connector.contains("fallbackAnswer"))
        assertTrue(connector.contains("configurationIssue"))
        assertTrue(connector.contains("MAX_RETRY_ATTEMPTS"))
        assertTrue(connector.contains("retryDelayMs"))
        assertTrue(runtime.contains("JarvisBrainConnector().also"))
        assertTrue(listener.contains("JarvisBrainRuntime.connector(this)"))
        assertTrue(listener.contains("JarvisQuestionDetector.extractQuestion"))
        assertTrue(listener.contains("JarvisBrainSpeechPolicy.speechFor(answer)"))
        assertTrue(listener.contains("speaker.speak(spoken)"))
        assertTrue(listener.contains("JarvisBrainSpeechPolicy.safeFallback()"))
        assertFalse(listener.contains("answer.voiceSummary.ifBlank { answer.summary }"))
        assertFalse(listener.contains("speaker.speak(reason)"))
        assertFalse(listener.contains("Sir, checking the Founder Brain."))
        assertFalse(listener.contains("brainConnector.shutdown()"))
        assertFalse(personalSources.contains("Founder Brain is not connected"))
        assertFalse(personalSources.contains("Founder Brain is unavailable right now."))
        assertFalse(personalSources.contains("Founder Brain responded, but the voice answer was empty."))
        assertFalse(personalSources.contains("Founder Brain API URL is missing from this APK build."))
        assertFalse(personalSources.contains("Founder Brain token is missing from this APK build."))
        assertFalse(personalSources.contains("Founder Brain rejected the API token."))
        assertFalse(personalSources.contains("routeConfidence"))
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
        assertTrue(wakeService.contains("AudioState.IDLE"))
        assertTrue(wakeService.contains("AudioState.LISTENING"))
        assertTrue(wakeService.contains("AudioState.PROCESSING"))
        assertTrue(wakeService.contains("claimIdleForListening()"))
        assertTrue(wakeService.contains("claimListeningForProcessing()"))
        assertTrue(wakeService.contains("JarvisWakeWordEngine.containsWakeWord"))
        assertTrue(wakeService.contains("private object JarvisWakeWordEngine"))
        assertTrue(wakeService.contains("JarvisVoiceSession"))
        assertTrue(wakeService.contains("activeSession != null"))
        assertTrue(wakeService.contains("WAKE_DEBOUNCE_MS"))
        assertTrue(wakeService.contains("suppressRecognizerCallbacksUntilMs"))
        assertTrue(wakeService.contains("shouldSuppressRecognizerCallback"))
        assertTrue(wakeService.contains("COMMAND_TRANSITION_SUPPRESSION_MS"))
        assertTrue(wakeService.contains("NO_MATCH_RESTART_DELAY_MS"))
        assertTrue(wakeService.contains("FOLLOW_UP_COMMAND_LISTEN_DELAY_MS"))
        assertTrue(wakeService.contains("handleCommandResults"))
        assertTrue(wakeService.contains("askFounderBrain(session, question)"))
        assertTrue(wakeService.contains("sessionId = session.id"))
        assertTrue(wakeService.contains("JarvisBrainRuntime.connector(this)"))
        assertFalse(wakeService.contains("!connector.isReady()"))
        assertTrue(wakeService.contains("activeSession?.id != session.id"))
        assertTrue(wakeService.contains("releaseSession("))
        assertTrue(wakeService.contains("JarvisBrainSpeechPolicy.speechFor(answer)"))
        assertTrue(wakeService.contains("speaker?.speak(speech)"))
        assertTrue(wakeService.contains(".setSilent(true)"))
        assertTrue(wakeService.contains("audioFocusAttached"))
        assertTrue(wakeService.contains("if (audioFocusAttached)"))
        assertTrue(wakeService.contains("Audio focus request skipped: already attached"))
        assertFalse(wakeService.contains("private var listening = false"))
        assertFalse(wakeService.contains("listening = false"))
        assertFalse(wakeService.contains("listening = true"))
        val wakeDetection = wakeService.substringAfter("private fun handleWakeWordDetected")
            .substringBefore("override fun onReadyForSpeech")
        assertTrue(wakeDetection.contains("recognizer?.cancel()"))
        assertTrue(wakeDetection.contains("scheduleListeningRestart(COMMAND_LISTEN_DELAY_MS)"))
        assertFalse(wakeService.contains("private fun restartListening"))
        assertTrue(wakeService.contains("scheduleListeningRestart"))
        assertTrue(wakeService.contains("retryWakeListening"))
        assertTrue(wakeService.contains("COMMAND_LISTEN_DELAY_MS"))
        assertTrue(wakeService.contains("RESTART_DELAY_MS"))
        assertTrue(wakeService.contains("SpeechRecognizer.ERROR_NO_MATCH -> NO_MATCH_RESTART_DELAY_MS"))
        assertTrue(wakeService.contains("Follow-up command window scheduled"))
        assertTrue(wakeService.contains("Jarvis command captured: chars="))
        assertTrue(wakeService.contains("Founder Brain voiceSummary received: chars="))
        val onResults = wakeService.substringAfter("override fun onResults")
            .substringBefore("override fun onError")
        assertTrue(onResults.contains("shouldSuppressRecognizerCallback(\"onResults\")"))
        assertFalse(onResults.contains("restartListening"))
        assertTrue(onResults.contains("scheduleListeningRestart"))
        val onError = wakeService.substringAfter("override fun onError")
            .substringBefore("override fun onEvent")
        assertTrue(onError.contains("shouldSuppressRecognizerCallback(\"onError:"))
        assertFalse(onError.contains("restartListening"))
        assertTrue(onError.contains("scheduleListeningRestart"))
        assertTrue(wakeService.contains("Foreground service lifecycle: onCreate"))
        assertTrue(wakeService.contains("Foreground service lifecycle: onStartCommand"))
        assertTrue(wakeService.contains("Foreground service lifecycle: onDestroy"))
        assertTrue(wakeService.contains("SpeechRecognizer start"))
        assertTrue(wakeService.contains("SpeechRecognizer stop"))
        assertTrue(wakeService.contains("AudioRecord start"))
        assertTrue(wakeService.contains("AudioRecord stop"))
        assertTrue(wakeService.contains("Audio focus requested"))
        assertFalse(wakeService.contains("Founder Brain is not connected"))
        assertFalse(wakeService.contains("Founder Brain is unavailable right now."))
        assertFalse(wakeService.contains("speaker?.speak(reason)"))
        assertFalse(wakeService.contains("speaker?.speak(answer.summary)"))
        assertTrue(connector.contains("val voiceSummary = json.optString(\"voiceSummary\").trim()"))
        assertTrue(connector.contains("missing required voiceSummary"))
        assertTrue(connector.contains("JarvisBrainSpeechPolicy.SAFE_FALLBACK_MESSAGE"))
        assertTrue(connector.contains(".put(\"sessionId\", sessionId)"))
        assertTrue(connector.contains(".addHeader(\"X-Aritenis-Session-Id\", sessionId)"))
        assertTrue(connector.contains("fun isReady()"))
        assertTrue(speechPolicy.contains("answer.voiceSummary.trim()"))
        assertFalse(speechPolicy.contains("answer.summary"))
        assertTrue(speechPolicy.contains("SAFE_FALLBACK_MESSAGE"))
        assertTrue(speechPolicy.contains("route confidence"))
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
