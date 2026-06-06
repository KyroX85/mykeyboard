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
                currentMilestone = "Jarvis reliability",
                latestCommit = "abcdef123456",
                latestBuild = "versionName=1.0.12; versionCode=12",
                ciState = "in_progress",
                knownBlockers = listOf("transcript accuracy"),
                lastVerifiedTimestamp = "2026-06-06T10:00:00Z"
            )
        )

        assertTrue(answer.contains("Facts:"))
        assertTrue(answer.contains("latest verified commit is abcdef1234"))
        assertTrue(answer.contains("Current state: milestone is Jarvis reliability"))
        assertTrue(answer.contains("Next action: clear transcript accuracy"))
    }

    @Test
    fun doesNotInventFactsWhenSnapshotIsEmpty() {
        val answer = ProjectOperationalResponseMode.buildAnswer(
            ProjectSnapshot(
                currentMilestone = null,
                latestCommit = null,
                latestBuild = null,
                ciState = null,
                knownBlockers = null,
                lastVerifiedTimestamp = null
            )
        )

        assertEquals("I do not have enough verified project data yet.", answer)
    }

    @Test
    fun operationalAnswerAvoidsFounderBrainStyleLanguage() {
        val answer = ProjectSnapshotResponseFormatter.voiceSummary(
            ProjectSnapshot(
                currentMilestone = "Jarvis reliability",
                latestCommit = "1234567890",
                latestBuild = null,
                ciState = null,
                knownBlockers = null,
                lastVerifiedTimestamp = "2026-06-06T10:00:00Z"
            )
        )

        assertFalse(answer.contains("dream", ignoreCase = true))
        assertFalse(answer.contains("vision", ignoreCase = true))
        assertFalse(answer.contains("becoming", ignoreCase = true))
        assertTrue(answer.contains("Facts:"))
        assertTrue(answer.contains("Current state:"))
        assertTrue(answer.contains("Next action:"))
    }
}
