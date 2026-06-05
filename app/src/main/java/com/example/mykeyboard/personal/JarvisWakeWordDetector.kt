package com.example.mykeyboard.personal

object JarvisWakeWordDetector {
    private const val ACCEPTED_CONFIDENCE = 1.0f
    private const val REJECTED_CONFIDENCE = 0.0f

    fun containsWakeWord(text: String): Boolean =
        evaluate(text).accepted

    fun evaluate(text: String): WakeDecision {
        val normalized = text.normalizeForWakeWord()
        if (normalized.isBlank()) {
            return WakeDecision(false, normalized, REJECTED_CONFIDENCE, "blank")
        }

        val words = normalized.split(" ")
        if (words.size < 2) {
            return WakeDecision(false, normalized, REJECTED_CONFIDENCE, "single word or incomplete wake phrase")
        }

        val hasCompleteWakePhrase = words.windowed(size = 2, step = 1).any { pair ->
            pair[0] == "hey" && pair[1] == "jarvis"
        }

        return if (hasCompleteWakePhrase) {
            WakeDecision(true, normalized, ACCEPTED_CONFIDENCE, "complete hey jarvis phrase")
        } else {
            WakeDecision(false, normalized, REJECTED_CONFIDENCE, "missing complete hey jarvis phrase")
        }
    }

    private fun String.normalizeForWakeWord(): String =
        lowercase()
            .replace(Regex("[^a-z\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    data class WakeDecision(
        val accepted: Boolean,
        val normalizedPhrase: String,
        val confidence: Float,
        val reason: String
    )
}
