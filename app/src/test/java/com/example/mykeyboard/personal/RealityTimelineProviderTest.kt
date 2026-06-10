package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

class RealityTimelineProviderTest {
    private val clock = Clock.fixed(
        Instant.parse("2026-06-10T12:00:00Z"),
        ZoneId.of("Asia/Kolkata")
    )

    @Test
    fun returnsEventsTodayFromLocalStartOfDay() {
        val provider = RealityTimelineProvider(
            store = InMemoryRealityEventStore(
                listOf(
                    event("old", RealityEventType.BUILD_FAILED, "2026-06-09T17:00:00Z"),
                    event("today-1", RealityEventType.BUILD_PASSED, "2026-06-09T18:31:00Z"),
                    event("today-2", RealityEventType.COMMIT_CREATED, "2026-06-10T11:00:00Z")
                )
            ),
            clock = clock
        )

        assertEquals(
            listOf("today-1", "today-2"),
            provider.getEventsToday().map { it.eventId }
        )
    }

    @Test
    fun returnsEventsLast24Hours() {
        val provider = RealityTimelineProvider(
            store = InMemoryRealityEventStore(
                listOf(
                    event("old", RealityEventType.BUILD_FAILED, "2026-06-09T11:59:00Z"),
                    event("recent", RealityEventType.TASK_BLOCKED, "2026-06-09T12:01:00Z")
                )
            ),
            clock = clock
        )

        assertEquals(listOf("recent"), provider.getEventsLast24Hours().map { it.eventId })
    }

    @Test
    fun returnsEventsLast7Days() {
        val provider = RealityTimelineProvider(
            store = InMemoryRealityEventStore(
                listOf(
                    event("old", RealityEventType.BUILD_FAILED, "2026-06-03T11:59:00Z"),
                    event("week", RealityEventType.TASK_COMPLETED, "2026-06-03T12:01:00Z")
                )
            ),
            clock = clock
        )

        assertEquals(listOf("week"), provider.getEventsLast7Days().map { it.eventId })
    }

    @Test
    fun formatsEvidenceCountsWithoutFounderBrainReasoning() {
        val summary = RealityTimelineResponseFormatter.voiceSummary(
            events = listOf(
                event("build", RealityEventType.BUILD_PASSED, "2026-06-10T09:00:00Z"),
                event("commit-1", RealityEventType.COMMIT_CREATED, "2026-06-10T10:00:00Z"),
                event("commit-2", RealityEventType.COMMIT_CREATED, "2026-06-10T11:00:00Z"),
                event("blocked", RealityEventType.TASK_BLOCKED, "2026-06-10T11:30:00Z")
            ),
            window = RealityTimelineWindow.TODAY
        )

        assertEquals("Today: 1 build passed; 2 commits created; 1 task blocked.", summary)
    }

    @Test
    fun emptyTimelineDoesNotInventEvents() {
        assertEquals(
            "I do not have verified reality events for today yet.",
            RealityTimelineResponseFormatter.voiceSummary(emptyList(), RealityTimelineWindow.TODAY)
        )
    }

    @Test
    fun classifiesTimelineQuestions() {
        assertEquals(RealityTimelineWindow.TODAY, RealityTimelineQuestionClassifier.windowFor("What happened today?"))
        assertEquals(RealityTimelineWindow.LAST_24_HOURS, RealityTimelineQuestionClassifier.windowFor("What happened yesterday?"))
        assertEquals(RealityTimelineWindow.LAST_7_DAYS, RealityTimelineQuestionClassifier.windowFor("What changed this week?"))
    }

    private fun event(id: String, type: RealityEventType, timestamp: String): RealityEvent =
        RealityEvent(
            eventId = id,
            eventType = type,
            timestamp = timestamp,
            source = RealityEventSource.LOCAL_GRADLE,
            evidenceSource = "test:$id",
            payload = emptyMap()
        )
}
