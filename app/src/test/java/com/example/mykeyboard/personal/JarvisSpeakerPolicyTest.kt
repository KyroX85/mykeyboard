package com.example.mykeyboard.personal

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class JarvisSpeakerPolicyTest {
    @Test
    fun speakerUsesDeterministicVoiceAndAudioPolicy() {
        val speaker = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisSpeaker.kt").readText()

        assertTrue(speaker.contains("GOOGLE_TTS_ENGINE = \"com.google.android.tts\""))
        assertTrue(speaker.contains("TextToSpeech(appContext, this, engine)"))
        assertTrue(speaker.contains("SPEECH_RATE = 1.0f"))
        assertTrue(speaker.contains("PITCH = 1.0f"))
        assertTrue(speaker.contains("SPEECH_VOLUME = 1.0f"))
        assertTrue(speaker.contains("AudioManager.STREAM_MUSIC"))
        assertTrue(speaker.contains("requestAudioFocus()"))
        assertTrue(speaker.contains("AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)"))
        assertTrue(speaker.contains("TextToSpeech.Engine.KEY_PARAM_STREAM"))
        assertTrue(speaker.contains("TextToSpeech.Engine.KEY_PARAM_VOLUME"))
        assertTrue(speaker.contains("engine.stop()"))
        assertTrue(speaker.contains("TextToSpeech.QUEUE_FLUSH"))
        assertTrue(speaker.contains("UtteranceProgressListener"))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }
}
