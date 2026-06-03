package com.example.mykeyboard.personal

object JarvisWakeWordDetector {
    private val wakeWordPattern = Regex(
        pattern = """\b(?:hey\s+jarvis|jarvis)\b""",
        options = setOf(RegexOption.IGNORE_CASE)
    )

    fun containsWakeWord(text: String): Boolean =
        wakeWordPattern.containsMatchIn(text.normalizeForWakeWord())

    private fun String.normalizeForWakeWord(): String =
        lowercase()
            .replace(Regex("[^a-z\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}
