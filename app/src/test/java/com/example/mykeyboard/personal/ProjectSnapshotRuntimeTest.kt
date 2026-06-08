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
                currentPhase = "",
                currentMilestone = "",
                latestCommit = "",
                latestCommitMessage = "",
                commitsToday = "",
                buildStatus = "",
                lastSuccessfulBuild = "",
                lastFailedBuild = "",
                ciState = "",
                knownBlockers = "",
                openBlockers = "",
                activeRuntimeModules = "",
                versionName = "",
                versionCode = 0,
                buildVerifiedAt = ""
            )
        )

        assertNull(snapshot.currentPhase)
        assertNull(snapshot.currentMilestone)
        assertNull(snapshot.lastSuccessfulBuild)
        assertNull(snapshot.lastFailedBuild)
        assertNull(snapshot.latestCommitMessage)
        assertNull(snapshot.commitsToday)
        assertNull(snapshot.openBlockers)
        assertNull(snapshot.latestApkVersion)
        assertNull(snapshot.activeRuntimeModules)
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
                currentPhase = "Phase 1 protected plus Phase 2 Explain active",
                currentMilestone = "Jarvis reliability sprint",
                latestCommit = "abc1234",
                latestCommitMessage = "expand jarvis reality snapshot",
                commitsToday = "3",
                buildStatus = "local_debug_assembled",
                lastSuccessfulBuild = "Android CI #42",
                lastFailedBuild = "Product Lab #12",
                ciState = "in_progress",
                knownBlockers = "wake reliability|transcript accuracy",
                openBlockers = "false wake rate; transcript accuracy",
                activeRuntimeModules = "JarvisWakeWordService|FounderBrainConnector",
                versionName = "1.0.7",
                versionCode = 7,
                buildVerifiedAt = "2026-06-06T10:00:00Z"
            )
        )

        assertEquals("Phase 1 protected plus Phase 2 Explain active", snapshot.currentPhase)
        assertEquals("Jarvis reliability sprint", snapshot.currentMilestone)
        assertEquals("Android CI #42", snapshot.lastSuccessfulBuild)
        assertEquals("Product Lab #12", snapshot.lastFailedBuild)
        assertEquals("expand jarvis reality snapshot", snapshot.latestCommitMessage)
        assertEquals(3, snapshot.commitsToday)
        assertEquals(listOf("false wake rate", "transcript accuracy"), snapshot.openBlockers)
        assertEquals("versionName=1.0.7; versionCode=7", snapshot.latestApkVersion)
        assertEquals(listOf("JarvisWakeWordService", "FounderBrainConnector"), snapshot.activeRuntimeModules)
        assertEquals("abc1234", snapshot.latestCommit)
        assertEquals("versionName=1.0.7; versionCode=7; status=local_debug_assembled", snapshot.latestBuild)
        assertEquals("in_progress", snapshot.ciState)
        assertEquals(listOf("wake reliability", "transcript accuracy"), snapshot.knownBlockers)
        assertEquals("2026-06-06T10:00:00Z", snapshot.lastVerifiedTimestamp)
        assertTrue(snapshot.hasEvidence())
    }

    private data class FakeProjectSnapshotBuildInfo(
        override val currentPhase: String,
        override val currentMilestone: String,
        override val latestCommit: String,
        override val latestCommitMessage: String,
        override val commitsToday: String,
        override val buildStatus: String,
        override val lastSuccessfulBuild: String,
        override val lastFailedBuild: String,
        override val ciState: String,
        override val knownBlockers: String,
        override val openBlockers: String,
        override val activeRuntimeModules: String,
        override val versionName: String,
        override val versionCode: Int,
        override val buildVerifiedAt: String
    ) : ProjectSnapshotBuildInfo
}
