package com.example.mykeyboard.personal

import java.util.Locale

data class JarvisNotificationSnapshot(
    val packageName: String,
    val title: String,
    val text: String,
    val bigText: String = ""
)

data class JarvisReleaseSignal(
    val speech: String,
    val title: String,
    val message: String,
    val priority: Priority
) {
    enum class Priority {
        READY,
        FAILED,
        PASSED
    }
}

object JarvisReleaseDetector {
    private val releaseSources = listOf(
        "firebase",
        "app distribution",
        "github",
        "actions",
        "mykeyboard",
        "aritenis"
    )
    private val apkReadyWords = listOf("apk", "release", "distributed", "app distribution", "build")
    private val passWords = listOf("success", "succeeded", "passed", "completed", "ready", "available")
    private val failWords = listOf("failed", "failure", "cancelled", "error", "unsuccessful")

    fun detect(snapshot: JarvisNotificationSnapshot): JarvisReleaseSignal? {
        val haystack = listOf(
            snapshot.packageName,
            snapshot.title,
            snapshot.text,
            snapshot.bigText
        ).joinToString(" ").lowercase(Locale.US)

        val isRelevantSource = releaseSources.any { haystack.contains(it) }
        val isReleaseRelated = apkReadyWords.any { haystack.contains(it) }
        if (!isRelevantSource || !isReleaseRelated) return null

        val displayTitle = snapshot.title.ifBlank { "Aritenis build update" }.take(MAX_DISPLAY_CHARS)
        val displayMessage = listOf(snapshot.text, snapshot.bigText)
            .firstOrNull { it.isNotBlank() }
            .orEmpty()
            .take(MAX_DISPLAY_CHARS)
            .ifBlank { "A new Aritenis build notification was detected." }

        return when {
            failWords.any { haystack.contains(it) } -> JarvisReleaseSignal(
                speech = "Sir, the Aritenis build failed.",
                title = "Build failed",
                message = displayMessage,
                priority = JarvisReleaseSignal.Priority.FAILED
            )
            passWords.any { haystack.contains(it) } -> JarvisReleaseSignal(
                speech = "Sir, a new Aritenis APK is ready.",
                title = "New APK ready",
                message = displayMessage,
                priority = JarvisReleaseSignal.Priority.READY
            )
            else -> JarvisReleaseSignal(
                speech = "Sir, there is a new Aritenis build update.",
                title = displayTitle,
                message = displayMessage,
                priority = JarvisReleaseSignal.Priority.PASSED
            )
        }
    }

    private const val MAX_DISPLAY_CHARS = 140
}
