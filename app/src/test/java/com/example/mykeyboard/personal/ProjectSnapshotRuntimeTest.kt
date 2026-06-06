package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectSnapshotRuntimeTest {
    @Test
    fun blankBuildFieldsBecomeNullInsteadOfGuessedValues() {
        val snapshot = ProjectSnapshotRuntime.capture(
            FakeProjectSnapshotBuildInfo(
                currentMilestone = "",
                latestCommit = "",
                buildStatus = "",
                ciState = "",
                knownBlockers = "",
                versionName = "",
                versionCode = 0,
                buildVerifiedAt = ""
            )
        )

        assertNull(snapshot.currentMilestone)
        assertNull(snapshot.latestCommit)
        assertNull(snapshot.latestBuild)
        assertNull(snapshot.ciState)
        assertNull(snapshot.knownBlockers)
        assertNull(snapshot.lastVerifiedTimestamp)
    }

    @Test
    fun capturesOnlyExplicitProjectEvidence() {
        val snapshot = ProjectSnapshotRuntime.capture(
            FakeProjectSnapshotBuildInfo(
                currentMilestone = "Jarvis reliability sprint",
                latestCommit = "abc1234",
                buildStatus = "local_debug_assembled",
                ciState = "in_progress",
                knownBlockers = "wake reliability|transcript accuracy",
                versionName = "1.0.7",
                versionCode = 7,
                buildVerifiedAt = "2026-06-06T10:00:00Z"
            )
        )

        assertEquals("Jarvis reliability sprint", snapshot.currentMilestone)
        assertEquals("abc1234", snapshot.latestCommit)
        assertEquals("versionName=1.0.7; versionCode=7; status=local_debug_assembled", snapshot.latestBuild)
        assertEquals("in_progress", snapshot.ciState)
        assertEquals(listOf("wake reliability", "transcript accuracy"), snapshot.knownBlockers)
        assertEquals("2026-06-06T10:00:00Z", snapshot.lastVerifiedTimestamp)
        assertTrue(snapshot.hasEvidence())
    }

    private data class FakeProjectSnapshotBuildInfo(
        override val currentMilestone: String,
        override val latestCommit: String,
        override val buildStatus: String,
        override val ciState: String,
        override val knownBlockers: String,
        override val versionName: String,
        override val versionCode: Int,
        override val buildVerifiedAt: String
    ) : ProjectSnapshotBuildInfo
}
