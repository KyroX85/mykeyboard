package com.example.mykeyboard.personal

object JarvisQuestionDetector {
    private val addressedPattern = Regex("(?i)(^|\\s)(hey\\s+)?(jarvis|aritenis)[:,\\s]+")

    fun extractQuestion(snapshot: JarvisNotificationSnapshot): String? {
        val candidate = listOf(snapshot.title, snapshot.text, snapshot.bigText)
            .joinToString(" ")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (candidate.isBlank() || !candidate.contains("?")) return null

        val match = addressedPattern.find(candidate) ?: return null

        return candidate.substring(match.range.last + 1)
            .trim()
            .take(MAX_QUESTION_CHARS)
            .takeIf { it.isNotBlank() }
    }

    private const val MAX_QUESTION_CHARS = 500
}
