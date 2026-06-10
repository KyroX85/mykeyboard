package com.example.mykeyboard.personal

import java.time.Instant

data class RealitySnapshot(
    val currentMilestone: String? = null,
    val currentBlockers: List<String>? = null,
    val recentProgress: List<String>? = null,
    val recentActivity: List<String>? = null,
    val snapshotConfidence: Float = 0.0f,
    val lastVerifiedTimestamp: String? = null
) {
    fun hasEvidence(): Boolean =
        currentMilestone != null ||
            currentBlockers != null ||
            recentProgress != null ||
            recentActivity != null ||
            lastVerifiedTimestamp != null
}

object RealitySnapshotGenerator {
    fun generate(events: List<RealityEvent>): RealitySnapshot {
        val validEvents = events
            .mapNotNull { event -> event.timestampInstantOrNull()?.let { timestamp -> timestamp to event } }
            .sortedBy { (timestamp, _) -> timestamp }
        if (validEvents.isEmpty()) return RealitySnapshot()

        val orderedEvents = validEvents.map { (_, event) -> event }
        val currentMilestone = orderedEvents
            .asReversed()
            .firstNotNullOfOrNull { event -> event.payload.valueFor("milestone", "current_milestone") }
        val currentBlockers = orderedEvents
            .filter { it.eventType == RealityEventType.TASK_BLOCKED }
            .mapNotNull { event -> event.payload.valueFor("blocker", "task", "reason") }
            .distinct()
            .takeIf { it.isNotEmpty() }
        val recentProgress = orderedEvents
            .filter { it.eventType.isProgressEvent() }
            .mapNotNull { it.progressLabel() }
            .takeLast(MAX_RECENT_ITEMS)
            .takeIf { it.isNotEmpty() }
        val recentActivity = orderedEvents
            .mapNotNull { it.activityLabel() }
            .takeLast(MAX_RECENT_ITEMS)
            .takeIf { it.isNotEmpty() }
        val lastVerifiedTimestamp = validEvents.maxByOrNull { (timestamp, _) -> timestamp }?.first?.toString()

        return RealitySnapshot(
            currentMilestone = currentMilestone,
            currentBlockers = currentBlockers,
            recentProgress = recentProgress,
            recentActivity = recentActivity,
            snapshotConfidence = confidenceFor(orderedEvents),
            lastVerifiedTimestamp = lastVerifiedTimestamp
        )
    }

    private fun confidenceFor(events: List<RealityEvent>): Float =
        (events.size * CONFIDENCE_PER_EVENT)
            .coerceAtMost(MAX_CONFIDENCE)

    private fun RealityEventType.isProgressEvent(): Boolean =
        when (this) {
            RealityEventType.BUILD_PASSED,
            RealityEventType.COMMIT_CREATED,
            RealityEventType.TASK_COMPLETED,
            RealityEventType.REMINDER_COMPLETED,
            RealityEventType.CONTACT_LEARNED,
            RealityEventType.PERSONAL_FACT_ADDED -> true
            RealityEventType.BUILD_STARTED,
            RealityEventType.BUILD_FAILED,
            RealityEventType.TASK_CREATED,
            RealityEventType.TASK_BLOCKED,
            RealityEventType.REMINDER_CREATED -> false
        }

    private fun RealityEvent.progressLabel(): String? =
        payload.valueFor("summary", "message", "task", "commit_message", "relationship", "category")
            ?: eventType.defaultActivityLabel()

    private fun RealityEvent.activityLabel(): String? =
        payload.valueFor("summary", "message", "task", "commit_message", "blocker", "reason", "relationship", "category")
            ?: eventType.defaultActivityLabel()

    private fun RealityEventType.defaultActivityLabel(): String? =
        when (this) {
            RealityEventType.BUILD_STARTED -> "Build started"
            RealityEventType.BUILD_PASSED -> "Build passed"
            RealityEventType.BUILD_FAILED -> "Build failed"
            RealityEventType.COMMIT_CREATED -> "Commit created"
            RealityEventType.TASK_CREATED -> "Task created"
            RealityEventType.TASK_COMPLETED -> "Task completed"
            RealityEventType.TASK_BLOCKED -> "Task blocked"
            RealityEventType.REMINDER_CREATED -> "Reminder created"
            RealityEventType.REMINDER_COMPLETED -> "Reminder completed"
            RealityEventType.CONTACT_LEARNED -> "Contact learned"
            RealityEventType.PERSONAL_FACT_ADDED -> "Personal fact added"
        }

    private fun Map<String, String>.valueFor(vararg keys: String): String? =
        keys.firstNotNullOfOrNull { key -> this[key]?.trim()?.takeIf { it.isNotEmpty() } }

    private fun RealityEvent.timestampInstantOrNull(): Instant? =
        runCatching { Instant.parse(timestamp) }.getOrNull()

    private const val MAX_RECENT_ITEMS = 5
    private const val CONFIDENCE_PER_EVENT = 0.15f
    private const val MAX_CONFIDENCE = 0.9f
}
