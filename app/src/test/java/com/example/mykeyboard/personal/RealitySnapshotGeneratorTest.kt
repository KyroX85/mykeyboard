package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RealitySnapshotGeneratorTest {
    @Test
    fun emptyEventsProduceNullSnapshotFields() {
        val snapshot = RealitySnapshotGenerator.generate(emptyList())

        assertNull(snapshot.currentMilestone)
        assertNull(snapshot.currentBlockers)
        assertNull(snapshot.recentProgress)
        assertNull(snapshot.recentActivity)
        assertEquals(0.0f, snapshot.snapshotConfidence)
        assertNull(snapshot.lastVerifiedTimestamp)
        assertFalse(snapshot.hasEvidence())
    }

    @Test
    fun derivesBlockersMilestoneProgressAndActivityOnlyFromPayloadEvidence() {
        val snapshot = RealitySnapshotGenerator.generate(
            listOf(
                event(
                    id = "blocked",
                    type = RealityEventType.TASK_BLOCKED,
                    timestamp = "2026-06-10T08:00:00Z",
                    payload = mapOf("blocker" to "remote APK distribution failed")
                ),
                event(
                    id = "commit",
                    type = RealityEventType.COMMIT_CREATED,
                    timestamp = "2026-06-10T09:00:00Z",
                    payload = mapOf(
                        "commit_message" to "feat: add jarvis reality timeline",
                        "milestone" to "personal operator"
                    )
                ),
                event(
                    id = "build",
                    type = RealityEventType.BUILD_PASSED,
                    timestamp = "2026-06-10T10:00:00Z",
                    payload = mapOf("summary" to "debug APK assembled")
                )
            )
        )

        assertEquals("personal operator", snapshot.currentMilestone)
        assertEquals(listOf("remote APK distribution failed"), snapshot.currentBlockers)
        assertEquals(listOf("feat: add jarvis reality timeline", "debug APK assembled"), snapshot.recentProgress)
        assertEquals(
            listOf("remote APK distribution failed", "feat: add jarvis reality timeline", "debug APK assembled"),
            snapshot.recentActivity
        )
        assertEquals("2026-06-10T10:00:00Z", snapshot.lastVerifiedTimestamp)
        assertTrue(snapshot.snapshotConfidence > 0.0f)
    }

    @Test
    fun missingMilestoneStaysNullInsteadOfGuessed() {
        val snapshot = RealitySnapshotGenerator.generate(
            listOf(
                event(
                    id = "commit",
                    type = RealityEventType.COMMIT_CREATED,
                    timestamp = "2026-06-10T09:00:00Z",
                    payload = mapOf("commit_message" to "feat: add jarvis reality timeline")
                )
            )
        )

        assertNull(snapshot.currentMilestone)
        assertEquals(listOf("feat: add jarvis reality timeline"), snapshot.recentProgress)
    }

    private fun event(
        id: String,
        type: RealityEventType,
        timestamp: String,
        payload: Map<String, String>
    ): RealityEvent =
        RealityEvent(
            eventId = id,
            eventType = type,
            timestamp = timestamp,
            source = RealityEventSource.LOCAL_GIT,
            evidenceSource = "test:$id",
            payload = payload
        )
}
