package com.example.mykeyboard.personal

import java.util.Locale

enum class JarvisConversationCommandType {
    QUESTION,
    CONTINUE_PROMPT,
    TAKE_REST
}

object JarvisConversationCommand {
    fun classify(text: String): JarvisConversationCommandType {
        val normalized = text.normalizedForConversationCommand()
        return when {
            normalized.contains("take rest") ||
                normalized.contains("jarvis take rest") ||
                normalized.contains("goodbye jarvis") ||
                normalized.contains("sleep jarvis") ||
                normalized.contains("go sleep") ||
                normalized.contains("go to sleep") ||
                normalized.contains("stop listening") -> JarvisConversationCommandType.TAKE_REST

            normalized == "continue" ||
                normalized == "next" ||
                normalized.contains("anything else") -> JarvisConversationCommandType.CONTINUE_PROMPT

            else -> JarvisConversationCommandType.QUESTION
        }
    }

    private fun String.normalizedForConversationCommand(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}
