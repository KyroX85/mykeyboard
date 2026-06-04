package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Test

class JarvisBrainSpeechPolicyTest {
    @Test
    fun speaksVoiceSummaryOnly() {
        val answer = JarvisBrainAnswer(
            voiceSummary = "  Short voice answer.  ",
            executionIntent = "open_app"
        )

        assertEquals("Short voice answer.", JarvisBrainSpeechPolicy.speechFor(answer))
    }

    @Test
    fun usesSafeFallbackWhenVoiceSummaryIsBlank() {
        val answer = JarvisBrainAnswer(
            voiceSummary = " ",
            fallbackMessage = " "
        )

        assertEquals(
            "I couldn't process that right now",
            JarvisBrainSpeechPolicy.speechFor(answer)
        )
    }

    @Test
    fun hidesInternalDebugOutputFromVoiceLayer() {
        val answer = JarvisBrainAnswer(
            voiceSummary = "Route confidence 0.7. HTTP 500 from Founder Brain."
        )

        assertEquals(
            "I couldn't process that right now",
            JarvisBrainSpeechPolicy.speechFor(answer)
        )
    }
}
