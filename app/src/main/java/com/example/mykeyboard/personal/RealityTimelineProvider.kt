package com.example.mykeyboard.personal

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

class RealityTimelineProvider(
    private val store: RealityEventStore,
    private val clock: Clock = Clock.systemDefaultZone()
) {
    fun getEventsToday(): List<RealityEvent> {
        val startOfDay = LocalDate.now(clock)
            .atStartOfDay(clock.zone)
            .toInstant()
        return eventsSince(startOfDay)
    }

    fun getEventsLast24Hours(): List<RealityEvent> =
        eventsSince(Instant.now(clock).minus(Duration.ofHours(24)))

    fun getEventsLast7Days(): List<RealityEvent> =
        eventsSince(Instant.now(clock).minus(Duration.ofDays(7)))

    private fun eventsSince(start: Instant): List<RealityEvent> =
        store.all()
            .mapNotNull { event -> event.timestampInstantOrNull()?.let { timestamp -> timestamp to event } }
            .filter { (timestamp, _) -> !timestamp.isBefore(start) && !timestamp.isAfter(Instant.now(clock)) }
            .sortedBy { (timestamp, _) -> timestamp }
            .map { (_, event) -> event }
}

object RealityTimelineQuestionClassifier {
    fun windowFor(question: String): RealityTimelineWindow? {
        val normalized = question.normalizedTimelineQuestion()
        return when {
            normalized.contains("last 24 hours") || normalized.contains("past 24 hours") ->
                RealityTimelineWindow.LAST_24_HOURS
            normalized.contains("last 7 days") ||
                normalized.contains("what changed this week") ||
                normalized.contains("what happened this week") ||
                normalized.contains("what did i complete this week") ->
                RealityTimelineWindow.LAST_7_DAYS
            normalized.contains("yesterday") ->
                RealityTimelineWindow.LAST_24_HOURS
            normalized.contains("what happened today") || normalized.contains("what changed today") || normalized == "today" ->
                RealityTimelineWindow.TODAY
            else -> null
        }
    }

    fun isTimelineQuestion(question: String): Boolean =
        windowFor(question) != null

    private fun String.normalizedTimelineQuestion(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}

enum class RealityTimelineWindow {
    TODAY,
    LAST_24_HOURS,
    LAST_7_DAYS
}

object RealityTimelineResponseFormatter {
    fun voiceSummary(events: List<RealityEvent>, window: RealityTimelineWindow): String {
        if (events.isEmpty()) {
            return "I do not have verified reality events for ${window.label()} yet."
        }
        val counts = events.groupingBy { it.eventType }.eachCount()
        val summary = counts.entries
            .sortedBy { it.key.ordinal }
            .joinToString("; ") { (type, count) -> "$count ${type.voiceLabel(count)}" }
        return "${window.heading()}: $summary."
    }

    private fun RealityTimelineWindow.heading(): String =
        when (this) {
            RealityTimelineWindow.TODAY -> "Today"
            RealityTimelineWindow.LAST_24_HOURS -> "Last 24 hours"
            RealityTimelineWindow.LAST_7_DAYS -> "Last 7 days"
        }

    private fun RealityTimelineWindow.label(): String =
        when (this) {
            RealityTimelineWindow.TODAY -> "today"
            RealityTimelineWindow.LAST_24_HOURS -> "the last 24 hours"
            RealityTimelineWindow.LAST_7_DAYS -> "the last 7 days"
        }

    private fun RealityEventType.voiceLabel(count: Int): String {
        val labels = when (this) {
            RealityEventType.BUILD_STARTED -> "build started" to "builds started"
            RealityEventType.BUILD_PASSED -> "build passed" to "builds passed"
            RealityEventType.BUILD_FAILED -> "build failed" to "builds failed"
            RealityEventType.COMMIT_CREATED -> "commit created" to "commits created"
            RealityEventType.TASK_CREATED -> "task created" to "tasks created"
            RealityEventType.TASK_COMPLETED -> "task completed" to "tasks completed"
            RealityEventType.TASK_BLOCKED -> "task blocked" to "tasks blocked"
            RealityEventType.REMINDER_CREATED -> "reminder created" to "reminders created"
            RealityEventType.REMINDER_COMPLETED -> "reminder completed" to "reminders completed"
            RealityEventType.CONTACT_LEARNED -> "contact learned" to "contacts learned"
            RealityEventType.PERSONAL_FACT_ADDED -> "personal fact added" to "personal facts added"
        }
        return if (count == 1) labels.first else labels.second
    }
}

private fun RealityEvent.timestampInstantOrNull(): Instant? =
    runCatching { Instant.parse(timestamp) }.getOrNull()
