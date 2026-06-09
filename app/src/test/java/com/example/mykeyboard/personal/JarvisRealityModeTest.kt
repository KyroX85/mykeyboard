package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisRealityModeTest {
    @Test
    fun blocksProjectAnswerWhenConfidenceIsBelowThreshold() {
        val snapshot = ProjectSnapshot(
            lastVerifiedTimestamp = "2026-06-09T10:00:00Z"
        )
        val decision = projectDecision(snapshot)

        val verdict = JarvisRealityMode.evaluateProject(
            decision = decision,
            nowMs = timestampMs("2026-06-09T10:05:00Z")
        )

        assertFalse(verdict.canAnswer)
        assertEquals("UNKNOWN", verdict.truthStatus)
        assertEquals("INSUFFICIENT DATA.", verdict.speech)
        assertEquals("2026-06-09T10:00:00Z", verdict.lastVerifiedTimestamp)
    }

    @Test
    fun blocksProjectAnswerWhenSnapshotIsOutdated() {
        val snapshot = verifiedProjectSnapshot(lastVerifiedTimestamp = "2026-06-06T10:00:00Z")
        val decision = projectDecision(snapshot)

        val verdict = JarvisRealityMode.evaluateProject(
            decision = decision,
            nowMs = timestampMs("2026-06-09T10:00:00Z")
        )

        assertFalse(verdict.canAnswer)
        assertEquals("OUTDATED", verdict.truthStatus)
        assertEquals("Project state is outdated. Refresh required.", verdict.speech)
        assertEquals("runtime project snapshot", verdict.sourcesUsed.single())
        assertEquals("2026-06-06T10:00:00Z", verdict.lastVerifiedTimestamp)
    }

    @Test
    fun allowsProjectAnswerWhenSnapshotIsFreshAndConfident() {
        val snapshot = verifiedProjectSnapshot(lastVerifiedTimestamp = "2026-06-09T09:30:00Z")
        val decision = projectDecision(snapshot)

        val verdict = JarvisRealityMode.evaluateProject(
            decision = decision,
            nowMs = timestampMs("2026-06-09T10:00:00Z")
        )

        assertTrue(verdict.canAnswer)
        assertEquals("VERIFIED", verdict.truthStatus)
        assertNull(verdict.speech)
        assertEquals("runtime project snapshot", verdict.sourcesUsed.single())
        assertEquals("2026-06-09T09:30:00Z", verdict.lastVerifiedTimestamp)
    }

    @Test
    fun blocksAgentAnswerWhenVisibilityHasNoConfidence() {
        val snapshot = AgentVisibilitySnapshot(lastVerifiedTimestamp = "2026-06-09T10:00:00Z")
        val decision = JarvisRealityDecision(
            route = JarvisRealityRoute.AGENTS,
            truthStatus = "UNKNOWN",
            sourcesUsed = listOf("question route classifier"),
            missingData = snapshot.missingFields(),
            safeResponseMode = "INSUFFICIENT_DATA",
            awarenessAttempted = true,
            realityScore = JarvisRealityScorer.score(JarvisRealityRoute.AGENTS, agentSnapshot = snapshot),
            agentVisibilitySnapshot = snapshot
        )

        val verdict = JarvisRealityMode.evaluateAgents(
            decision = decision,
            nowMs = timestampMs("2026-06-09T10:05:00Z")
        )

        assertFalse(verdict.canAnswer)
        assertEquals("INSUFFICIENT DATA.", verdict.speech)
    }

    private fun verifiedProjectSnapshot(lastVerifiedTimestamp: String): ProjectSnapshot =
        ProjectSnapshot(
            currentMilestone = "Jarvis Reality Mode",
            latestCommitMessage = "add reality mode",
            latestCommit = "abcdef123456",
            commitsToday = 1,
            lastVerifiedTimestamp = lastVerifiedTimestamp
        )

    private fun projectDecision(snapshot: ProjectSnapshot): JarvisRealityDecision =
        JarvisRealityDecision(
            route = JarvisRealityRoute.PROJECT,
            truthStatus = if (snapshot.hasEvidence()) "PARTIAL" else "UNKNOWN",
            sourcesUsed = listOf("runtime project snapshot"),
            missingData = snapshot.missingFields(),
            safeResponseMode = "PARTIAL_WITH_LIMITS",
            awarenessAttempted = true,
            realityScore = JarvisRealityScorer.score(JarvisRealityRoute.PROJECT, snapshot),
            projectSnapshot = snapshot
        )

    private fun timestampMs(value: String): Long =
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(value)!!.time
}
