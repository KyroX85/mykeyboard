package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisRealityScorerTest {
    @Test
    fun operationalProjectQuestionsReachRealityTargetWithSnapshotFields() {
        val score = JarvisRealityScorer.score(
            JarvisRealityRoute.PROJECT,
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
                latestCommit = "abcdef123",
                latestBuild = "versionName=1.0.12; versionCode=12",
                ciState = "success",
                knownBlockers = listOf("transcript accuracy"),
                lastVerifiedTimestamp = "2026-06-06T10:00:00Z"
            )
        )

        assertTrue(score.realityPercent >= 80)
        assertEquals(14, score.factsUsed)
        assertEquals(
            listOf(
                "current_phase",
                "current_milestone",
                "last_successful_build",
                "last_failed_build",
                "latest_commit_message",
                "commits_today",
                "open_blockers",
                "latest_apk_version",
                "active_runtime_modules",
                "latest_commit",
                "latest_build",
                "ci_state",
                "known_blockers",
                "last_verified_timestamp"
            ),
            score.snapshotFieldsUsed
        )
        assertFalse(score.founderBrainUsed)
    }

    @Test
    fun reflectionQuestionsStayBelowRealityTargetAndUseFounderBrain() {
        val score = JarvisRealityScorer.score(JarvisRealityRoute.REFLECTION)

        assertTrue(score.realityPercent <= 20)
        assertEquals(0, score.factsUsed)
        assertTrue(score.snapshotFieldsUsed.isEmpty())
        assertTrue(score.founderBrainUsed)
    }

    @Test
    fun missingProjectSnapshotDoesNotInventReality() {
        val score = JarvisRealityScorer.score(JarvisRealityRoute.PROJECT, null)

        assertEquals(0, score.realityPercent)
        assertEquals(0, score.factsUsed)
        assertTrue(score.snapshotFieldsUsed.isEmpty())
        assertFalse(score.founderBrainUsed)
    }
}
