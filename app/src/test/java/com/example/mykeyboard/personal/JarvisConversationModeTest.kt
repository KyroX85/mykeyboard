package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisConversationModeTest {
    @Test
    fun wakeAcknowledgementClearlySignalsListeningState() {
        assertEquals("Yes Sir, I'm listening.", JarvisConversationModePolicy.WAKE_ACKNOWLEDGEMENT)
    }

    @Test
    fun firstAnswerPromptsForFollowup() {
        val speech = JarvisConversationModePolicy.appendStateCue(
            answer = "Project state is outdated. Refresh required.",
            mode = JarvisConversationMode.WAITING_FOR_FOLLOWUP
        )

        assertEquals("Project state is outdated. Refresh required. Anything else?", speech)
    }

    @Test
    fun laterAnswersPromptForNextInstruction() {
        val speech = JarvisConversationModePolicy.appendStateCue(
            answer = "INSUFFICIENT DATA.",
            mode = JarvisConversationMode.WAITING_FOR_INSTRUCTION
        )

        assertEquals("INSUFFICIENT DATA. Understood. Waiting for next instruction.", speech)
    }

    @Test
    fun blankAnswerStillIndicatesState() {
        assertTrue(
            JarvisConversationModePolicy.appendStateCue("", JarvisConversationMode.WAITING_FOR_FOLLOWUP)
                .contains("Anything else?")
        )
    }
}
