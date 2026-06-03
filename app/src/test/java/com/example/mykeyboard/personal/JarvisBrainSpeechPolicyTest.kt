package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Test

class JarvisBrainSpeechPolicyTest {
    @Test
    fun speaksVoiceSummaryOnly() {
        val answer = JarvisBrainAnswer(
            type = "reflection",
            summary = "This longer summary must not be spoken.",
            voiceSummary = "  Short voice answer.  ",
            confidence = 0.87
        )

        assertEquals("Short voice answer.", JarvisBrainSpeechPolicy.speechFor(answer))
    }

    @Test
    fun doesNotFallbackToSummaryWhenVoiceSummaryIsBlank() {
        val answer = JarvisBrainAnswer(
            type = "reflection",
            summary = "This raw reasoning or summary must stay hidden.",
            voiceSummary = " ",
            confidence = 0.72
        )

        assertEquals("", JarvisBrainSpeechPolicy.speechFor(answer))
    }
}
