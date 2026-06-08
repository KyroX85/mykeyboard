package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectOperationalResponseModeTest {
    @Test
    fun buildsFactsCurrentStateAndNextActionFromSnapshot() {
        val answer = ProjectOperationalResponseMode.buildAnswer(
            ProjectSnapshot(
                currentPhase = "Phase 1 protected plus Phase 2 Explain active",
                currentMilestone = "Jarvis reliability",
                lastSuccessfulBuild = "Android CI #42",
                lastFailedBuild = "Product Lab #12",
                latestCommitMessage = "expand jarvis reality snapshot",
                commitsToday = 3,
                openBlockers = listOf("transcript accuracy"),
                latestApkVersion = "versionName=1.0.12; versionCode=12",
                activeRuntimeModules = listOf("JarvisWakeWordService", "FounderBrainConnector"),
                latestCommit = "abcdef123456",
                latestBuild = "versionName=1.0.12; versionCode=12",
                ciState = "in_progress",
                knownBlockers = listOf("transcript accuracy"),
                lastVerifiedTimestamp = "2026-06-06T10:00:00Z"
            )
        )

        assertTrue(answer.contains("Facts:"))
        assertTrue(answer.contains("commits today: 3"))
        assertTrue(answer.contains("latest commit: expand jarvis reality snapshot"))
        assertTrue(answer.contains("APK versionName=1.0.12; versionCode=12"))
        assertTrue(answer.contains("Current State: phase is Phase 1 protected plus Phase 2 Explain active"))
        assertTrue(answer.contains("milestone is Jarvis reliability"))
        assertTrue(answer.contains("Next Action: clear transcript accuracy"))
    }

    @Test
    fun doesNotInventFactsWhenSnapshotIsEmpty() {
        val answer = ProjectOperationalResponseMode.buildAnswer(
            ProjectSnapshot()
        )

        assertEquals("I do not have enough verified project data yet.", answer)
    }

    @Test
    fun operationalAnswerAvoidsFounderBrainStyleLanguage() {
        val answer = ProjectSnapshotResponseFormatter.voiceSummary(
            ProjectSnapshot(
                currentMilestone = "Jarvis reliability",
                latestCommitMessage = "expand jarvis reality snapshot",
                commitsToday = 1,
                latestCommit = "1234567890",
                lastVerifiedTimestamp = "2026-06-06T10:00:00Z"
            )
        )

        assertFalse(answer.contains("dream", ignoreCase = true))
        assertFalse(answer.contains("vision", ignoreCase = true))
        assertFalse(answer.contains("becoming", ignoreCase = true))
        assertTrue(answer.contains("Facts:"))
        assertTrue(answer.contains("Current State:"))
        assertTrue(answer.contains("Next Action:"))
    }

    @Test
    fun operationalAnswerKeepsFactsCurrentStateAndNextActionShapeWithSparseSnapshot() {
        val answer = ProjectOperationalResponseMode.buildAnswer(
            ProjectSnapshot(
                latestCommitMessage = "add operational intelligence routing",
                latestCommit = "abcdef123456",
                lastVerifiedTimestamp = "2026-06-08T10:00:00Z"
            )
        )

        assertTrue(answer.contains("Facts:"))
        assertTrue(answer.contains("latest commit: add operational intelligence routing"))
        assertTrue(answer.contains("Current State: unknown"))
        assertTrue(answer.contains("Next Action: no verified next action available"))
    }
}
