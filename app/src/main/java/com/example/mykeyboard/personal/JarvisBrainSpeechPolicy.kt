package com.example.mykeyboard.personal

object JarvisBrainSpeechPolicy {
    const val SAFE_FALLBACK_MESSAGE = "I couldn't process that right now"

    fun speechFor(answer: JarvisBrainAnswer): String {
        val candidate = answer.voiceSummary.trim()
            .ifBlank { answer.fallbackMessage?.trim().orEmpty() }
        if (candidate.isBlank() || containsInternalOutput(candidate)) {
            return SAFE_FALLBACK_MESSAGE
        }
        return candidate
    }

    fun safeFallback(): String = SAFE_FALLBACK_MESSAGE

    private fun containsInternalOutput(text: String): Boolean {
        val normalized = text.lowercase()
        return INTERNAL_OUTPUT_MARKERS.any { marker -> normalized.contains(marker) }
    }

    private val INTERNAL_OUTPUT_MARKERS = listOf(
        "route confidence",
        "routeconfidence",
        "rawreasoning",
        "debug",
        "system error",
        "api token",
        "api url",
        "http ",
        "endpoint",
        "configuration",
        "founder brain",
        "not connected"
    )
}
