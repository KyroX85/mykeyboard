package com.example.mykeyboard.personal

enum class JarvisConversationMode {
    WAITING_FOR_FOLLOWUP,
    WAITING_FOR_INSTRUCTION,
    CONVERSATION_COMPLETE
}

object JarvisConversationModePolicy {
    const val WAKE_ACKNOWLEDGEMENT = "Yes Sir, I'm listening."
    const val FOLLOWUP_PROMPT = "Anything else?"
    const val INSTRUCTION_PROMPT = "Understood. Waiting for next instruction."
    const val REST_RESPONSE = "Resting now, Sir."

    fun promptForNextTurn(turnCount: Int): String =
        if (turnCount <= 1) FOLLOWUP_PROMPT else INSTRUCTION_PROMPT

    fun appendStateCue(answer: String, mode: JarvisConversationMode): String {
        val trimmedAnswer = answer.trim()
        val cue = when (mode) {
            JarvisConversationMode.WAITING_FOR_FOLLOWUP -> FOLLOWUP_PROMPT
            JarvisConversationMode.WAITING_FOR_INSTRUCTION -> INSTRUCTION_PROMPT
            JarvisConversationMode.CONVERSATION_COMPLETE -> REST_RESPONSE
        }
        if (trimmedAnswer.isBlank()) return cue
        return "$trimmedAnswer $cue"
    }
}
